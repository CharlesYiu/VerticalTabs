const MAIN_TAB_GROUP_TITLE = "..."
const MAIN_TAB_GROUP_COLOR = "grey"
const MAIN_TAB_GROUP_COLLAPSED = true

const tabsElement = document.getElementById("tabs")

let mainTabGroupId = null
let activatedTabId = null

async function ensureMainTabGroup(){
    let createdNewGroup = false
    async function createMainTabGroup() {
        mainTabGroupId = await chrome.tabs.group({
            tabIds: (await getAllTabs()).map(tab => tab.id)
        })
        await activateTab(activatedTabId)

        createdNewGroup = true
    }
    if (mainTabGroupId == null) {
        let groups = await chrome.tabGroups.query({
            title: MAIN_TAB_GROUP_TITLE,
            color: MAIN_TAB_GROUP_COLOR,
            windowId: chrome.windows.WINDOW_ID_CURRENT
        })
        if (groups.length > 0) {
            mainTabGroupId = groups[0].id
            return
        }
        await createMainTabGroup()
    } else {
        try { chrome.tabGroups.get(mainTabGroupId) == null }
        catch {
            await createMainTabGroup()
        }
    }
    await chrome.tabGroups.update(mainTabGroupId, {
        title: MAIN_TAB_GROUP_TITLE,
        color: MAIN_TAB_GROUP_COLOR,
        collapsed: MAIN_TAB_GROUP_COLLAPSED
    })
    return createdNewGroup
}

chrome.tabs.onActivated.addListener(activeInfo => {
    ensureMainTabGroup()
        .then(async function(skip) {
            if (skip) return
            console.log(activatedTabId, activeInfo.tabId)
            const previousTabElement = await ensureTabElement(activatedTabId)
            const tabElement = await ensureTabElement(activeInfo.tabId)
            console.log(activeInfo)
            if (activatedTabId != null) {
                try {
                    await chrome.tabs.group({
                        groupId: mainTabGroupId,
                        tabIds: [activatedTabId]
                    })
                } catch { }
            }
            await chrome.tabs.ungroup([activeInfo.tabId])
            activatedTabId = activeInfo.tabId
            previousTabElement.classList.remove("active")
            tabElement.classList.add('active')
            await chrome.tabGroups.update(mainTabGroupId, {
                collapsed: MAIN_TAB_GROUP_COLLAPSED
            })
        })
})
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    const tabElement = document.getElementById(tabId)
    if (tabElement == null) return
    console.log("changed")
    if (changeInfo.title != null) tabElement.children[3].textContent = changeInfo.title
    if (changeInfo.favIconUrl != null) tabElement.children[2].src = changeInfo.favIconUrl
    switch (changeInfo.status) {
        case "unloaded":
            tabElement.classList.add("unloaded")
            break
        case "loading":
            tabElement.classList.remove("unloaded")
            tabElement.classList.add("loading")
            break
        case "complete":
            tabElement.classList.remove("loading", "unloaded")
            break
        default:
            break
    }
})

async function removeTab(tabId) {
    await ensureMainTabGroup()
    await chrome.tabs.remove(tabId)
    activatedTabId = (await getCurrentTab()).id
    console.log(tabId, activatedTabId)
    await activateTab(activatedTabId)
}
async function activateTab(tabId) {
    await ensureMainTabGroup()
    await chrome.tabs.ungroup([tabId])
    await chrome.tabs.update(tabId, {
        active: true
    })
    await chrome.tabs.move(tabId, {
        index: -1
    })
}

async function addTabElement(tab) {
    console.log("added tab", tab)

    const tabElement = document.createElement("div")
    tabElement.className = `tab${tab.active ? " active" : ""}`
    tabElement.id = tab.id

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
        const previousTabElement = document.getElementById(activatedTabId)
        if (previousTabElement != null) previousTabElement.classList.remove("active")
        console.log(previousTabElement, tab.id, activatedTabId)
        activateTab(tab.id)
    })
    tabCloseButton.addEventListener("click", event => {
        removeTab(tab.id)
        tabElement.remove()
        event.stopPropagation()
    })

    tabsElement.appendChild(tabElement)
    return tabElement
}
async function ensureTabElement(tabId) {
    let tabElement = document.getElementById(tabId)
    if (tabElement == null) {
        const tab = await chrome.tabs.get(tabId)
        tabElement = await addTabElement(tab)
    }
    return tabElement
}

document.getElementById("newtab").addEventListener("click", _ => {
    chrome.tabs.create({})
})

function processTabs() {
    getCurrentTab()
        .then(async function (currentTab) {
            activatedTabId = currentTab.id

            await ensureMainTabGroup()
            const tabs = await getAllTabs()
            tabs.forEach(async function(tab) {
                await addTabElement(tab)
            })
        })
}
processTabs()

document.getElementById("viewsource").addEventListener("click", _ => {
    chrome.tabs.create({
        url: "https://github.com/charlesyiu/verticaltabs"
    })
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
})