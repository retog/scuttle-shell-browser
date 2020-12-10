console.log('menu opened')
const menuArea = document.getElementById('options')
console.log(document, menuArea)
// this doesn't work: browser.tabs.getCurrent().then(...
browser.tabs.query({ "active": true, "currentWindow": true, "windowType": "normal" }).then(
  tabs => tabs[0]
).then(
  tab => {
    console.log('tab', tab)
    const relevantURL = tab.url.split('?')[0].split('#')[0]
    menuArea.innerHTML += `Allow the page at ${relevantURL} to access SSB?`
    const button = document.createElement('button')
    button.innerText = 'Grant'
    button.addEventListener('click', () => {

      browser.runtime.sendMessage({
        direction: "from-menu-script",
        message: {
          action: 'grant',
          target: relevantURL
        }
      });
    })
    menuArea.appendChild(button)
  },
  error => {
    console.log('error', error)
  })