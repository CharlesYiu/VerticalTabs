const MAIN_TAB_GROUP_TITLE = "..."
const MAIN_TAB_GROUP_COLOR = "grey"
const MAIN_TAB_GROUP_COLLAPSED = true

const tabsElement = document.getElementById("tabs")

let mainTabGroupId = null

let activatedTab = {
    id: null,
    index: null
}

async function getCurrentTab() {
    return (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
}
async function getAllTabs() {
    return await chrome.tabs.query({ currentWindow: true })
}

async function addToMainTabGroup(tabIds) {
    // try {
        await chrome.tabs.group({
            groupId: mainTabGroupId,
            tabIds: tabIds
        })
    // } catch { }
}
async function removeFromMainTabGroup(tabIds) {
    try {
        await chrome.tabs.ungroup(tabIds)
    } catch { }
}
async function ensureMainTabGroup(activeTabId = null){
    let createdNewGroup = false

    async function createMainTabGroup() {
        mainTabGroupId = await chrome.tabs.group({
            tabIds: (await getAllTabs()).map(tab => tab.id)
        })
        await activateTab(activeTabId == null ? activatedTab.id : activeTabId)

        createdNewGroup = true

        console.log("G", mainTabGroupId, "Main Tab Group Created")
    }

    if (mainTabGroupId == null) {
        let groups = await chrome.tabGroups.query({
            title: MAIN_TAB_GROUP_TITLE,
            color: MAIN_TAB_GROUP_COLOR,
            windowId: chrome.windows.WINDOW_ID_CURRENT
        })
        if (groups.length > 0) {
            mainTabGroupId = groups[0].id

            console.log("G", mainTabGroupId, "Main Tab Group Found")
            return
        }
        await createMainTabGroup()
    } else {
        try { await chrome.tabGroups.get(mainTabGroupId) }
        catch { await createMainTabGroup() }
    }

    await chrome.tabGroups.update(mainTabGroupId, {
        title: MAIN_TAB_GROUP_TITLE,
        color: MAIN_TAB_GROUP_COLOR,
        collapsed: MAIN_TAB_GROUP_COLLAPSED
    })
    return createdNewGroup
}
async function gatherToMainTabGroup() {
     await chrome.tabs.group({
         groupId: mainTabGroupId,
         tabIds: (await getAllTabs()).map(tab => tab.id).filter(tabId => tabId !== activatedTab.id)
    })
}

chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.windows.getCurrent({ })
        .then(async function(currentWindow) {
            if (currentWindow.id !== activeInfo.windowId) return

            await ensureMainTabGroup(activeInfo.tabId)
            const previousTabElement = await ensureTabElement(activatedTab.id)
            const tabElement = await ensureTabElement(activeInfo.tabId)

            const listIndex = Array.prototype.indexOf.call(tabsElement.children, document.getElementById(activeInfo.tabId).parentElement)
            const activatingTabIndex = listIndex === -1 ? (await chrome.tabs.get(activeInfo.tabId)).index : listIndex

            if (activatedTab.id != null) {
                const lastTabIndex = tabsElement.children.length - 1
                await addToMainTabGroup([activatedTab.id])
                await chrome.tabs.move(activatedTab.id, {
                    index: activatedTab.index -
                        ((activatedTab.index >= lastTabIndex) ||
                        (activatedTab.index > activatingTabIndex) ? 1 : 0)
                })

            }

            activatedTab = {
                id: activeInfo.tabId,
                index: activatingTabIndex
            }

            await removeFromMainTabGroup([activeInfo.tabId])

            if (previousTabElement != null) previousTabElement.classList.remove("active")
            tabElement.classList.add('active')

            await chrome.tabGroups.update(mainTabGroupId, {
                collapsed: MAIN_TAB_GROUP_COLLAPSED
            })

            console.log(activeInfo.tabId, "Tab Activation Heard")
        })
})
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    chrome.windows.getCurrent({ })
        .then(async function(currentWindow) {
            if (currentWindow.id !== removeInfo.windowId) return

            const tabElement = document.getElementById(tabId)
            if (tabElement == null) return

            tabElement.parentElement.remove()
        })
})
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    const tabElement = document.getElementById(tabId)
    if (tabElement == null) return
    if (changeInfo.title != null) {
        tabElement.children[3].textContent = changeInfo.title
        console.log(tabId, "Title Changed", changeInfo.title)
    }
    if (changeInfo.favIconUrl != null) {
        tabElement.children[2].src = changeInfo.favIconUrl
        console.log(tabId, "FavIcon Changed", changeInfo.favIconUrl)
    }
    switch (changeInfo.status) {
        case "unloaded":
            tabElement.classList.add("unloaded")
            console.log(tabId, "Tab Unloaded")
            break
        case "loading":
            tabElement.classList.remove("unloaded")
            tabElement.classList.add("loading")
            console.log(tabId, "Tab Loading")
            break
        case "complete":
            tabElement.classList.remove("loading", "unloaded")
            console.log(tabId, "Tab Complete")
            break
        default:
            break
    }

    console.log(tabId, "Tab Update Heard")
})

async function activateTab(tabId) {
    await ensureMainTabGroup()
    await chrome.tabs.update(tabId, { active: true })
    await chrome.tabs.move(tabId, { index: -1 })

    console.log(tabId, "Activated Tab Programmatically")
}
async function removeTab(tabId) {
    await ensureMainTabGroup()
    await chrome.tabs.remove(tabId)
    if (activatedTab.id === tabId) activatedTab = {
        id: null,
        index: null
    }

    console.log(tabId, "Removed Tab Programmatically")
}

function adjustActivatedTabIndex(tabId, newIndex, offset) {
    if (activatedTab.id === tabId) activatedTab.index = newIndex
    else if (activatedTab.index > newIndex) activatedTab.index -= 1
    else if (activatedTab.index === newIndex) {
        if (offset > 0) {
            activatedTab.index -= 1
        } else if (offset < 0) {
            activatedTab.index += 1
        }
    }
}

async function addTabElement(tab) {
    const tabContainer = document.createElement("div")
    tabContainer.className = "tab-container"

    const tabElement = document.createElement("div")
    tabElement.className = `tab${tab.active ? " active" : ""}`
    tabElement.draggable = true
    tabElement.id = tab.id
    tabContainer.appendChild(tabElement)

    const tabCloseButton = document.createElement("button")
    tabCloseButton.innerHTML = `<img src="assets/close.png" draggable="false">`
    tabElement.appendChild(tabCloseButton)

    const loaderElement = document.createElement("div")
    loaderElement.className = "loader"
    tabElement.appendChild(loaderElement)

    const tabFaviconElement = document.createElement("img")
    if (typeof tab.favIconUrl == "string" && tab.favIconUrl !== "") tabFaviconElement.src = tab.favIconUrl
    tabElement.appendChild(tabFaviconElement)

    const tabTitleElement = document.createElement("p")
    tabTitleElement.textContent = tab.title
    tabElement.appendChild(tabTitleElement)

    tabElement.addEventListener("click",  () => {
        const previousTabElement = document.getElementById(activatedTab.id)
        if (previousTabElement != null) previousTabElement.classList.remove("active")
        activateTab(tab.id)
    })
    tabCloseButton.addEventListener("click", event => {
        removeTab(tab.id)
        event.stopPropagation()
    })

    tabContainer.addEventListener("dragstart", _ => {
        const tabContainerIndex = Array.prototype.indexOf.call(tabsElement.children, tabContainer)
        dragged = {
            target: tabContainer,
            startIndex: tabContainerIndex
        }
        tabElement.classList.add("dragging")
    })
    tabContainer.addEventListener("dragend", _ => {
        tabElement.classList.remove("dragging")
    })
    tabContainer.addEventListener("dragover", event => {
        event.preventDefault()
        if (tabContainer === dragged.target) return

        const tabContainerIndex = Array.prototype.indexOf.call(tabsElement.children, tabContainer)
        const draggedContainerIndex = Array.prototype.indexOf.call(tabsElement.children, dragged.target)
        const offsetIndex = draggedContainerIndex <= tabContainerIndex ? 1 : 0

        tabsElement.insertBefore(dragged.target, tabsElement.children[tabContainerIndex + offsetIndex])
    })
    tabContainer.addEventListener("drop", _ => {
        const tabContainerIndex = Array.prototype.indexOf.call(tabsElement.children, tabContainer)
        const offset = (tabContainerIndex - dragged.startIndex)
        if (tab.id !== activatedTab.id) chrome.tabs.move(tab.id, {
            index: tabContainerIndex - (activatedTab.index < tabContainerIndex ? 1 : 0)
        })
        adjustActivatedTabIndex(tab.id, tabContainerIndex, offset)
        console.log(tab.id, "Tab Move Ended", offset)
    })

    tabsElement.appendChild(tabContainer)

    console.log(tab.id, "Added Tab Element", tabContainer)
    return tabElement
}
async function ensureTabElement(tabId) {
    let tabElement = document.getElementById(tabId)
    if (tabElement == null) {
        try {
            const tab = await chrome.tabs.get(tabId)
            tabElement = await addTabElement(tab)
        } catch { return null }
    }
    return tabElement
}

function processTabs() {
    getCurrentTab()
        .then(async function (currentTab) {
            activatedTab = {
                id: currentTab.id,
                index: currentTab.index
            }

            await ensureMainTabGroup()
            await gatherToMainTabGroup()
            const tabs = await getAllTabs()
            tabs.forEach(async function(tab) {
                await addTabElement(tab)
            })
        })
}
processTabs()

document.getElementById("viewsource").addEventListener("click", _ => {
    chrome.tabs.create({ url: "https://github.com/charlesyiu/verticaltabs" })
})
document.getElementById("reprocess").addEventListener("click", _ => {
    mainTabGroupId = null
    tabsElement.replaceChildren()
    processTabs()
})
const menubar = document.getElementById('menubar');
window.addEventListener("click", _ => {
    menubar.classList.add("hide")
})
document.getElementById('menu').addEventListener('click', event => {
    menubar.classList.toggle("hide")
    event.stopPropagation()
})

document.getElementById("newtab").addEventListener("click", _ => {
    chrome.tabs.create({})
})