const toggleSwitch = document.getElementById('toggle')
const locationArea = document.getElementById('location')
// this doesn't work: browser.tabs.getCurrent().then(...
browser.tabs.query({ "active": true, "currentWindow": true, "windowType": "normal" }).then(
  tabs => tabs[0]
).then(
  tab => {
    const relevantURL = tab.url.split('?')[0].split('#')[0]
    locationArea.innerText = relevantURL
    browser.storage.local.get('granted').then(result => {
      let granted = result.granted
      const enabled = !!~granted.indexOf(relevantURL)
      toggleSwitch.checked = enabled
      toggleSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
          granted.push(relevantURL)
        } else {
          granted = granted.filter(e => e !== relevantURL)
        }
        browser.storage.local.set({'granted': granted}).then(() => {
          return browser.runtime.sendMessage({
            direction: "from-menu-script",
            message: {
              action: e.target.checked ? 'grant' : 'revoke',
              target: relevantURL
            }
          })
        }).then(() => { window.setTimeout(window.close, 500) })
      })
    })
  },
  error => {
    console.log('error', error)
  }
)

  