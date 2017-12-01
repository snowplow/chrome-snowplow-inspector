var m = require('mithril');
var BeaconInspector = require('./BeaconInspector');


// Roughly, we want to:
// 1. get all previous beacons in this devtools session
// 2. add them to the table
// 3. set a chrome.devtools.network.onRequestFinished listener for future events
// 4. set up a chrome.devtools.network.onNavigated listener to collapse the previous tree


/*
Component structure
Mike wanted some chrome to: filter requests
We want to support multiple pageviews, those should be collapsible
The current pageview should be open as we navigate to it
Each pageview should show the beacon requests, time it occurred, it's type, it's method, and it's status
    Grouped beacons should probably be indicated in some way
Digging into the beacon should show:
    Our nice table of params split into relevant sections & named nicely (see fields.js)
    Context and unstructured event stuff should automatically be base64 decoded, and ideally have a nice tree interface
    Other request information, such as the network user ID
*/
m.mount(document.body, BeaconInspector);
