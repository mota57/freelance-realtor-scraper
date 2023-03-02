(async function initPopupWindow() {


  let loading = false;
  let states = [...new Set(USCities.map(r => r.state))].sort();

  let options = '';
  for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
    options += `<option value="${states[stateIndex]}">${states[stateIndex]}</option>`
  }

  let dropdownStates = createElementFromHTML(` <select data-id="state" class="MJgts cLCTBg filter-btn" style="margin-left:10px">` + options +` </select>`);

  let button = createElementFromHTML(`
  <div>
        <span data-id="extract-label">Extract</span>

        <span data-id="loading-image" style="display:none"><img class="alignnone" src="https://cdnjs.cloudflare.com/ajax/libs/galleriffic/2.0.1/css/loader.gif" alt="" width="28" height="28"></span>

        <span data-id="total-extracted"></span>

  </div>`);
  button.setAttribute('style', ` margin-left: 10px;
  background-color: rgb(217, 34, 40);
  display: inline-block;
  padding: 10px 20px;
  color: white;
  text-align: center;
  text-decoration: none;
  border-radius: 5px;
  cursor: pointer;
  `);


  window.addEventListener("load", function (event) {
    //let the user select his stuff

    document.querySelector('div[data-testid="facet-follow"] div:nth-child(1)').append(button);
    document.querySelector('div[data-testid="facet-follow"] div:nth-child(1)').append(dropdownStates);

    let spanTotal = button.querySelector('span[data-id="total-extracted"]');


    button.addEventListener('click', function (ev) {
      if (loading) { return; }

      var rowList = [];

      toggleButtonDisabled();

      try {
        var urlParams = getUrlParameters();
        var stateSelected = dropdownStates.value ? dropdownStates.value.trim() : null ;
        if (stateSelected == null || stateSelected == "" || stateSelected == undefined) {
          throw 'must select an state';
        }
        var zipCods = USCities.filter(x => x.state == stateSelected).map(x => x.zip_code);

        let zipSplitted = splitBy(zipCods, 2);

        zipSplitted.reduce((promiseChain, zips, i) => {
          return promiseChain.then(async () => {
            return await new Promise(resolve => {
              setTimeout(async function () {
                let rList = await extractData(zips, urlParams);
                console.log(rList);
                rowList = rowList.concat(rList);
                spanTotal.textContent = rowList.length;
                resolve(1);
              }, 10000);
            });
          });
        }, Promise.resolve())
          .then(() => {
            if (rowList.length > 0) {
              console.log(rowList);
              window.sessionStorage.setItem('rowList', rowList);
              window.localStorage.setItem('rowList2', rowList);
              var blob = convertArrayOfObjectsToCSV(rowList);
              saveAs(blob);

              toggleButtonDisabled();
            }
          });

      } catch (e) {
        alert(e.toString());
        toggleButtonDisabled();
      }
    });
  });

  function splitBy(records, x) {
    let count = 1;
    let row = [];
    let reqByX = [];
    for (let i = 0; i < records.length; i++) {
      row.push(records[i]);

      if (count % x === 0) {
        count = 1;
        reqByX.push(row);
        row = [];
      } else {
        count++;
      }
    }
    if ((reqByX.length * x) != records.length) {
      reqByX.push(records.slice(reqByX.length * x))
    }
    return reqByX;

  }


  function toggleButtonDisabled() {
    if (loading == false) {
      loading = true;
      button.querySelector('span[data-id="extract-label"]').style.display = 'none';
      button.querySelector('span[data-id="loading-image"]').style.display = 'inline-block';

      button.style.backgroundColor = "lightgray";
      button.style.cursor = 'not-allowed';
    } else {

      button.querySelector('span[data-id="extract-label"]').style.display = 'inline-block';
      button.querySelector('span[data-id="loading-image"]').style.display = 'none';

      button.style.backgroundColor = "rgb(217, 34, 40)";
      button.style.cursor = "pointer";

      loading = false;

    }
  }

  function createElementFromHTML(htmlString) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();

    // Change this to div.childNodes to support multiple top-level nodes.
    return div.firstChild;
  }

  /**for testing */
  async function extractDataFake(zipcodes, urlParams) {

    let { price1, price2, beds1, beds2 } = urlParams;
    console.log(beds2);
    return await Promise.resolve(zipcodes)
  }

  async function extractData(zipcodes, urlParams) {

    if (zipcodes == null || zipcodes.length == 0) { throw 'zipcode not a valid argument, must be an array with values'; }

    let { price1, price2, beds1, beds2 } = urlParams;

    let requests = [];

    for (let zipcode of zipcodes) {
      let data = {};
      data.zipcode = zipcode;
      data.urls = [];
      data.houses = 0;

      for (let p = price1; p <= price2; p += 10_000) {
        let topPrice = Number(p.toString().replaceAll('0', '9'));
        data.urls.push({ price: p, url: `https://www.realtor.com/realestateandhomes-search/${zipcode}/beds-${beds1}-${beds2}/price-${p}-${topPrice}` });
      }

      let promise = await fetchUrlsFromData(data)
      requests.push(promise);
    }

    let rowList = await fetchInSequence(requests);
    return rowList;
  }

  function getUrlParameters() {
    const regex = /(beds-\d+-\d+)|(price-\d+-\d+)/g;
    let matches = window.location.href.match(regex);

    if (matches && matches.length == 2) {
      let beds1 = Number(matches[0].split('-')[1]);
      let beds2 = Number(matches[0].split('-')[2]);
      let price1 = Number(matches[1].split('-')[1]);
      let price2 = Number(matches[1].split('-')[2]);

      return { price1, price2, beds1, beds2 };
    } else {
      console.debug('error matches not match');
      console.debug('matches:\n');
      console.debug(matches);
      throw ('select min price, max price, min bed and max bed');
    }
  }

  function saveAs(blob) {
    let url = URL.createObjectURL(blob);
    let link = document.createElement('a');
    link.href = url;
    link.download = generateFileName();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function generateFileName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const filename = `data_${year}${month}${day}_${hours}${minutes}${seconds}.csv`;
    return filename;
  }


  function convertArrayOfObjectsToCSV(rows) {
    const keys = getObjectKeysSorted(rows[0]);
    const rowList = rows.map(obj => {
      return keys.map(key => {
        let v = obj[key];
        if (typeof v == 'string') {
          return v.replaceAll(',', '');
        } else {
          return v;
        }
      }).join(',');
    });
    let csvString = `${keys.join(',')}\n${rowList.join('\n')}`;
    return new Blob([csvString], {
      type: 'text/csv'
    });
  }

  function getObjectKeysSorted(record) {
    var keys = Object.keys(record);
    keys = keys.sort((a, b) => {
      if (Number.isNaN(Number(a)) && Number.isNaN(Number(b))) {
        // If both elements are strings, compare them using the built-in string comparison
        return a.localeCompare(b);
      } else if (Number.isNaN(Number(a))) {
        // If only the first element is a string, it should come first
        return -1;
      } else {
        // If only the second element is a string, it should come second
        return 1;
      }
    });

    return keys;
  }

  async function fetchInSequence(requests) {
    let records = [];
    return new Promise((resolve, reject) => {
      requests.reduce((promiseChain, next) => {
        return promiseChain.then(async () => {
          let record = await next();
          records.push(record);
        });
      }, Promise.resolve())
        .then(() => resolve(records));
    });

  }

  async function fetchUrlsFromData(data) {
    // return new Promise(async (ok, bad) => {
    return async function fetchUrlsFromDataInner() {
      let excelRow = {
        zipcode: data.zipcode
      };

      var requests = data.urls.map(r => fetch(r.url));
      var responseList = await Promise.all(requests)
      var contentList = await Promise.all(responseList.map(x => x.text()))
      contentList.forEach((content, index) => {
        let houses = extractHomeNumber(content);
        let price = data.urls[index].price;
        excelRow[price] = houses;
      });
      return excelRow;

    }
    // return excelRow;
    // });
  }


  function extractHomeNumber(content) {
    try {
      var startIndex = content.indexOf('<span data-testid="results-header-count"');
      if (startIndex < 0) { return 0; }
      var subpart = content.substring(startIndex, startIndex + 1000);
      var span = subpart.substring(subpart.indexOf(">") + 1, subpart.indexOf("</span>"));
      console.log(span);
      var totalHouses = span.replace(/\D/g, '');
      return Number.isNaN(Number(totalHouses)) ? 0 : Number(totalHouses);
    } catch (e) {
      console.error(e);
      return -1;
    }
  }


  async function getTotalHomes(zipcode, beds1, beds2, price1, price2) {
    try {
      let stream = await fetch(`https://www.realtor.com/realestateandhomes-search/${zipcode}/beds-${beds1}-${beds2}/price-${price1}-${price2}`);
      let content = await stream.text();
      var startIndex = content.indexOf('<span data-testid="results-header-count"');
      var subpart = content.substring(startIndex, startIndex + 1000);
      var span = subpart.substring(subpart.indexOf(">") + 1, subpart.indexOf("</span>"));
      console.log(span);
      var totalHouses = span.replace(/\D/g, '');
      return totalHouses;
    } catch {
      return -1;
    }
  }



  // let filterBeds = document.querySelector('div[data-testid="filter-beds-dropdown"] > div > button:nth-child(1)')
  // .textContent.split(' ');

  // let beds = filterBeds[0];


  // try {
  //   port = chrome.runtime.connect({ name: "erank_cookie_shower" });

  //   port.postMessage({ request: "cookie" });
  //   console.log('connected');

  //   port.onMessage.addListener(function (msg) {

  //     console.log('debug::msg:: ', msg)

  //     if (msg.response == 'cookie_poll')
  //     {
  //       setTimeout(function () {
  //         port.postMessage({ request: "cookie" });
  //       }, 1000);
  //     } else if (msg.response && msg.response.length > 0 && msg.response.findIndex(x => x.name == 'Cookie') >= 0)
  //     {
  //       let cookie =  msg.response.find(x => x.name == 'Cookie');
  //       prompt('copy text selected', cookie.value);
  //       // chrome.runtime.sendMessage({ cookie: msg.response }).then(function (res) {});
  //     } else {
  //       alert('no cookie are you sure you are at the right url???');
  //     }

  //   });
  // } catch (e) {
  //   console.error(e);
  // }

})();