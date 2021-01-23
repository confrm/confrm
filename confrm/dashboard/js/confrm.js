import { drawNavbar } from './confrm-navbar.js';
import { updateConfigsTable } from './confrm-configs.js';
import { updatePackagesTable } from './confrm-packages.js';
import { updateNodesTable } from './confrm-nodes.js';

let nav_elements = [
  {
    "name": "Packages",
    "icon": "gg-album",
    "templates": ["packages.html"]
  },
  {
    "name": "Nodes",
    "icon": "gg-smartphone-ram",
    "templates": ["nodes.html"]
  },
  {
    "name": "Configuration",
    "icon": "gg-file-document",
    "templates": ["configuration.html"]
  },
];

// For storing draw methods
let pages = [];

// For page tracking
window.confrm_current_page = nav_elements[0].name;

// For storing templates
window.confrm_templates = [];

// General metadata
window.confrm_meta = {};

// Call the update function every 1200ms
setInterval(updateUIEvent, 1200);

drawNavbar(nav_elements);

setTimeout(function () {
  window.confrm_current_page = "packages";
  window.confrm_showPage("packages");
}, 200);

function drawHelper(name, body) {
  return { [name](...args) { return body(...args) } }[name];
}

pages.push(drawHelper("packages", () => {

  $("#page-content").html(window.confrm_templates["packages"]["packages.html"]);

  $("#packages-table-title").html(window.confrm_meta["packages"] + " Packages Installed");

  updatePackagesTable(true);

}));


pages.push(drawHelper("nodes", () => {

  $("#page-content").html(window.confrm_templates["nodes"]["nodes.html"]);

  $("#node-table-title").html(window.confrm_meta["nodes"] + " Nodes Registered");

  updateNodesTable(true);

}));


pages.push(drawHelper("configuration", () => {

  $("#page-content").html(window.confrm_templates["configuration"]["configuration.html"]);

  updateConfigsTable(true);

}));

window.addAlert = function (message, detail, state) {

  let type = "";
  switch (state) {
    case "WARNING":
      type = "alert-warning";
      break;
    case "SUCCESS":
      type = "alert-success";
      break;
    case "INFO":
      type = "alert-info";
      break;
    case "ERROR":
    default:
      type = "alert-danger";
      break;
  }

  let html = `
      <div class="alert ` + type + ` alert-dismissable" role="alert">
      <h3 class="mb-1">` + message + `</h3>
      <p>` + detail + `</p>
      <div class="btn-list">
        <a href="#" class="btn btn-success" data-bs-dismiss="alert">Okay</a>
      </div>
      </div>
    `;

  let current = $("#alerts").html();
  $("#alerts").html(html + current);

  // TODO: Once clicked the element should remove itself from the DOM properly
}

window.confrm_updateMeta = function (meta) {
  let data = $.ajax({
    url: "/info/",
    type: "GET"
  }).then((function (data) {
    for (let key in data) {
      meta[key] = data[key];
    }
    if ("packages" === window.confrm_current_page) {
      $("#packages-table-title").html(meta["packages"] + " Packages Installed");
    } else if ("nodes" == window.confrm_current_page) {
      $("#node-table-title").html(meta["nodes"] + " Nodes Registered");
    }
  }).bind(meta));
}

window.confrm_showPage = function (name) {
  for (let page in pages) {
    if (pages[page].name === name) {
      pages[page]();
    }
  }
}
window.confrm_updateMeta(window.confrm_meta);

function updateUIEvent() {
  if ("nodes" === window.confrm_current_page) {
    updateNodesTable();
  } else if ("packages" === window.confrm_current_page) {
    updatePackagesTable();
  }
}