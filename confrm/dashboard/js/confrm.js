import { drawNavbar } from './confrm-navbar.js';
import { updatePackagesTable } from './confrm-packages.js';

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
  //window.confrm_updateMeta(meta);

  // For storing which up elements have been drawn
  let drawn_nodes = [];
  let drawn_configs = [];

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

    // This list is used to track which nodes are currently drawn on the screen.
    // As this method is being called we can assume that this should be cleared
    // pending an update when updateNodeTables is called.
    drawn_nodes = [];

    updateNodesTable();

  }));


  pages.push(drawHelper("configuration", () => {

    $("#page-content").html(window.confrm_templates["configuration"]["configuration.html"]);

    // This list is used to track which nodes are currently drawn on the screen.
    // As this method is being called we can assume that this should be cleared
    // pending an update when updateNodeTables is called.
    drawn_configs = [];

    updateConfigsTable();

  }));




  function updateNodesTable() {

    let data = $.ajax({
      url: "/nodes/",
      type: "GET"
    }).then(function (data) {

      for (let entry in data) {

        let row = data[entry];

        let is_drawn = false;
        for (let node in drawn_nodes) {
          if (drawn_nodes[node] == row.node_id) {
            is_drawn = true;
          }
        }

        if (!is_drawn) {
          let html = "";
          html += `<tr id="node-` + row.node_id.replace(/:/g, "_") + `">`;
          html += `<td class="node-title">` + row.title + `  <span class="text-muted">(` + row.node_id + `)</span></td>`;
          html += `<td class="node-description">` + row.description + `</td>`;
          html += `<td class="node-package">` + row.package + `</td>`;
          html += `<td class="node-version">` + row.version + `</td>`;
          html += `<td class="node-platform">` + row.platform + `</td>`;
          html += `<td class="node-last_seen">` + row.last_seen + `</td>`;
          html += `<td class="node-last_updated">` + row.last_updated + `</td>`;
          html += `
            <td class="text-end">
              <span class="dropdown">
                <button class="btn dropdown-toggle align-text-top" data-bs-boundary="viewport"
                  data-bs-toggle="dropdown">Actions</button>
                <div class="dropdown-menu dropdown-menu-end">
                  <div class="dropdown-item nodes-title-button" style="cursor:pointer" 
                    data-bs-toggle="modal" data-bs-target="#modal-node"
                    data-nodeid="` + row.node_id + `" data-title="` + row.title + `" data-bs-backdrop="static"
                    data-bs-keyboard="false">
                    Set Title
                  </div>
                  <div class="dropdown-item nodes-change-package-button" style="cursor:pointer" 
                    data-bs-toggle="modal" data-bs-target="#modal-node" data-package="` + entry + `"
                    data-nodeid="` + row.node_id + `" data-title="` + row.description + `" data-bs-backdrop="static"
                    data-bs-keyboard="false">
                    Change Package
                  </div>
                  <div class="dropdown-item nodes-configure-button" style="cursor:pointer" 
                    data-bs-toggle="modal" data-bs-target="#modal-package-info" data-package="` + entry + `">
                    Configure Variables
                  </div>
                  <div class="dropdown-item nodes-delete-button" data-bs-target="#modal-node-confirm" style="cursor:pointer"
                  data-bs-toggle="modal" data-nodeid="` + row.node_id + `">
                    Delete Node
                  </div>
                </div>
              </span>
            </td>`;
          html += "</tr>";

          $("#nodes-table-body").append(html);
          drawn_nodes.push(row.node_id);


        } else {
          let headings = ["title", "description", "package", "version", "platform", "last_seen", "last_updated"];
          let node_id_tag = "#node-" + row.node_id.replace(/:/g, "_");
          for (let heading in headings) {
            let current = $(node_id_tag + " .node-" + headings[heading]).html();
            let element_type = typeof row[headings[heading]];
            if ("number" === element_type) {
              current = parseInt(current);
            }
            
            if ("title" === headings[heading]) {
              let titleHtml = row.title + `  <span class="text-muted">(` + row.node_id + `)</span>`;
              if (current !== titleHtml) {
                $(node_id_tag + " .node-" + headings[heading]).html(titleHtml);
              }
            } else if (current !== row[headings[heading]]) {
              $(node_id_tag + " .node-" + headings[heading]).html(row[headings[heading]]);
            }
          }
        }
      }

      /*
       * Creates the node plackage change modal window
       */
      $('.nodes-change-package-button').unbind("click");
      $('.nodes-change-package-button').click(function (sender) {
        // Populate the modal 
        let node_id = sender.currentTarget.dataset.nodeid;
        let node_title = sender.currentTarget.dataset.description;
        let current_package = sender.currentTarget.dataset.package;

        $("#modal-node .modal-title").html("Change Package for \"" + node_title + "\" (" + node_id + ")");

        let data = $.ajax({
          url: "/packages/",
          type: "GET"
        }).then(function (data) {

          let html = `<select class="form-select" name="package">`;
          for (let package_name in data) {
            html += `<option value="` + data[package_name].name + `"`;
            if (data[package_name].name === current_package) {
              html += ` selected`;
            }
            html += `">` + data[package_name].title + ` (` + data[package_name].name + `)</option>`
          }
          html += `</select>`;
          html += ` <input type="hidden" name="type" value="package">`;
          html += ` <input type="hidden" name="node_id" value="` + node_id + `">`;

          $("#modal-node .modal-body").html(html);
        });
      });

      /*
       * Creates the node title setting modal window
       */
      $('.nodes-title-button').unbind("click");
      $('.nodes-title-button').click(function (sender) {

        let node_id = sender.currentTarget.dataset.nodeid;
        let node_title = sender.currentTarget.dataset.title;

        $("#modal-node .modal-title").html("Change Title of \"" + node_title + "\" (" + node_id + ")");

        let html = `
          <label class="form-label">Node Title</label>
          <input type="text" name="title" class="form-select nodes-change-title" value="` + node_title + `">
        `;
        html += ` <input type="hidden" name="type" value="title">`;
        html += ` <input type="hidden" name="node_id" value="` + node_id + `">`;

        $("#modal-node .modal-body").html(html);
      });

      /*
       * Handle the user clicking submit on the general nodal for nodes
       */
      $('.nodes-modal-submit').unbind("click");
      $('.nodes-modal-submit').click(function (sender) {

        let inputs = $("#modal-node .modal-body").find("input");
        let type = "";

        for (let input in inputs) {
          if ("type" === inputs[input].name) {
            type = inputs[input].value;
          }
        }


        if ("title" == type) {

          let title = "", node_id = "";

          for (let input in inputs) {
            if ("node_id" === inputs[input].name) {
              node_id = inputs[input].value;
            } else if ("title" === inputs[input].name) {
              title = encodeURI(inputs[input].value);
              title = title.replace(/#/g, '%23');
            }
          }

          let url = "/node_title/";
          url += "?node_id=" + node_id;
          url += "&title=" + title;

          let data = $.ajax({
            url: url,
            type: "PUT"
          }).fail(function (jqXHR, textStatus, errorThrown) {
            let json = jqXHR.responseJSON;
            addAlert(json.message, json.detail, "ERROR");
            $(".nodes-modal-submit").unbind("click");
            $("#modal-node [data-bs-dismiss=modal]").trigger({ type: "click" });
          }).done(function (data, textStatus, jqXHR) {
            $(".nodes-modal-submit").unbind("click");
            $("#modal-node [data-bs-dismiss=modal]").trigger({ type: "click" });
          });

        } else if ("package" === type) {

          let node_id = "", package_name = "";

          for (let input in inputs) {
            if ("node_id" === inputs[input].name) {
              node_id = inputs[input].value;
            }
          }

          let selects = $("#modal-node .modal-body").find("select");

          for (let select in selects) {
            if ("package" === selects[select].name) {
              package_name = selects[select].value;
            }
          }

          let url = "/node_package/";
          url += "?node_id=" + node_id;
          url += "&package=" + package_name;

          let data = $.ajax({
            url: url,
            type: "PUT"
          }).fail(function (jqXHR, textStatus, errorThrown) {
            let json = jqXHR.responseJSON;
            addAlert(json.message, json.detail, "ERROR");
            $(".nodes-modal-submit").unbind("click");
            $("[data-bs-dismiss=modal]").trigger({ type: "click" });
          }).done(function (data, textStatus, jqXHR) {
            $(".nodes-modal-submit").unbind("click");
            $("[data-bs-dismiss=modal]").trigger({ type: "click" });
          });

        }

      });


    });

  }


  function updateConfigsTable() {

    
    $("#config-table-body").html("");

    let data = $.ajax({
      url: "/config/",
      type: "GET"
    }).then(function (data) {

      $("#config-table-body").html("");

      for (let entry in data) {

        let row = data[entry];

        let id = row.id;

        if ("package" === row.type && "undefined" !== typeof row.package_title) {
          id = row.package_title + ` (` + row.id + `)`;
        } else if("node" === row.type && "undefined" !== typeof row.node_title) {
          id = row.node_title + ` (` + row.id + `)`;
        }

        let html = "";
        html += `<tr>`;
        html += `<td class="config-key">` + row.key + `</td>`;
        html += `<td class="config-type">` + row.type + `</td>`;
        html += `<td class="config-id">` + id + `</td>`;
        html += `<td class="config-value">` + row.value + `</td>`;
        html += `
          <td class="text-end">
            <span class="dropdown">
              <button class="btn dropdown-toggle align-text-top" data-bs-boundary="viewport"
                data-bs-toggle="dropdown">Actions</button>
              <div class="dropdown-menu dropdown-menu-end">
                <div class="dropdown-item config-edit-button" style="cursor:pointer" 
                  data-bs-toggle="modal" data-bs-target="#modal-config" data-key="` + row.key + `"
                  data-id="` + row.id + `" data-type="` + row.type + `" data-value="` + row.value + `"
                  data-bs-backdrop="static" data-bs-keyboard="false">
                  Edit
                </div>
                <div class="dropdown-item config-delete-button" style="cursor:pointer" 
                  data-bs-toggle="modal" data-bs-target="#modal-config-confirm" data-key="` + row.key + `"
                  data-id="` + row.id + `" data-type="` + row.type + `" data-bs-backdrop="static"
                  data-bs-keyboard="false">
                  Delete
                </div>
              </div>
            </span>
          </td>`;
        html += "</tr>";

        $("#config-table-body").append(html);
      }

      /*
       * Creates the node package change modal window
       */
      $('.config-edit-button').unbind("click");
      $('.config-edit-button').click(function (sender) {

        // Populate the modal 
        let id = sender.currentTarget.dataset.id;
        let key = sender.currentTarget.dataset.key;
        let type = sender.currentTarget.dataset.type;
        let value = sender.currentTarget.dataset.value;

        $("#modal-config .modal-title").html("Edit Config");

        let html = `
              <div class="mb-3">
                <label class="form-label">Key</label>
                <input type="text" name="key" class="form-control" disabled="" value="` + key + `">
              </div>
              <div class="mb-3">
                <label class="form-label">Type</label>
                <input type="text" name="type" class="form-control" disabled="" value="` + type + `">
              </div>
        `;
        
        if ("global" !== type) {
          html += `<div class="mb-3">`;
        }

        if ("package" === type) {
          html += `<label class="form-label">Package</label>`;
        } else if ("node" === type) {
          html += `<label class="form-label">Node</label>`;
        }

        if ("global" !== type) {
          html += `<input type="text" name="id" class="form-control" value="` + id + `" 
            disabled=""></div>`;
        }

        html += `
              <div class="mb-3">
                <label class="form-label">Value</label>
                <input type="text" name="value" class="form-control" value="` + value + `">
              </div>
        `;

        $("#modal-config .modal-body").html(html);
      });

      /*
       * Creates the node title setting modal window
       */
      $(".config-delete-button").unbind("click");
      $(".config-delete-button").click(function (sender) {

        // Populate the modal 
        let id = sender.currentTarget.dataset.id;
        let key = sender.currentTarget.dataset.key;
        let type = sender.currentTarget.dataset.type;

        let html = `Do you really want to delete config "` + key + `"`;
        html += `<input type="hidden" name="id" value="` + id + `">`;
        html += `<input type="hidden" name="key" value="` + key + `">`;
        html += `<input type="hidden" name="type" value="` + type + `">`;

        if ("global" === type) {
          html += ` (global)`;
        } else if ("package" === type) {
          html += ` for package "` + id + `"`;
        } else if ("node" === type) {
          html += ` for node "` + id + `"`;
        }

        html += `? This cannot be undone.</div>`;

        $("#modal-config-confirm .modal-question").html(html);

      });

      $(".modal-config-confirm-yes").unbind("click");
      $(".modal-config-confirm-yes").click(function () {
        
        let inputs = $("#modal-config-confirm").find("input");

        let id = "";
        let key = "";
        let type = "";

        for (let input in inputs) {
          let val = inputs[input].value;
          switch (inputs[input].name) {
            case "id":
              id = val;
              break;
            case "key":
              key = val;
              break;
            case "type":
              type = val;
            default:
              break;
          }
        }

        let url = "/config/";
        url += "?type=" + type;
        url += "&key=" + key;
        if (type !== "global") {
          url += "&id=" + id;
        }

        let data = $.ajax({
          url: url,
          type: "DELETE"
        }).fail(function (jqXHR, textStatus, errorThrown) {
          let json = jqXHR.responseJSON;
          addAlert(json.message, json.detail, "ERROR");
          $(".modal-config-confirm-yes").unbind("click");
          $("#modal-config-confirm [data-bs-dismiss=modal]").trigger({ type: "click" });
        }).done(function (data, textStatus, jqXHR) {
          $(".modal-config-confirm-yes").unbind("click");
          $("#modal-config-confirm [data-bs-dismiss=modal]").trigger({ type: "click" });
          updateConfigsTable();
        });


      });

      /*
       * Handles the add button being pressed
       */
      $(".config-add-button").unbind("click");
      $(".config-add-button").click(function (sender) {
        let type = sender.currentTarget.dataset.type;

        if ("global" === type) {
          $("#modal-config-add .modal-title").html("Add global config");
          let html = `
              <div class="mb-3">
                <label class="form-label">Key</label>
                <input type="text" name="key" class="form-control" value="" autocomplete="off">
              </div>
              <div class="mb-3">
                <label class="form-label">Value</label>
                <input type="text" name="value" class="form-control" value="" autocomplete="off">
              </div>
          `;
          html += ` <input type="hidden" name="type" value="global">`;
          $("#modal-config-add .modal-body").html(html);
        } else if ("package" === type) {
          $("#modal-config-add .modal-title").html("Add package config");
          let data = $.ajax({
            url: "/packages/",
            type: "GET"
          }).then(function (data) {
 
            let html = `
              <div class="mb-3">
                <label class="form-label">Package</label>
                <select class="form-select" name="package">`;
            for (let package_name in data) {
              html += `<option value="` + data[package_name].name + `">` + data[package_name].title + ` (` + data[package_name].name + `)</option>`;
            }
            html += `
                </select>
              </div>`;

            html += `
              <div class="mb-3">
                <label class="form-label">Key</label>
                <input type="text" name="key" class="form-control" value="" autocomplete="off">
              </div>
              <div class="mb-3">
                <label class="form-label">Value</label>
                <input type="text" name="value" class="form-control" value="" autocomplete="off">
              </div>
            `;
            html += ` <input type="hidden" name="type" value="package">`;
 
            $("#modal-config-add .modal-body").html(html);
          });
        } else if ("node" === type) {
          $("#modal-config-add .modal-title").html("Add package config");
          let data = $.ajax({
            url: "/nodes/",
            type: "GET"
          }).then(function (data) {
 
            let html = `
              <div class="mb-3">
                <label class="form-label">Node</label>
                <select class="form-select" name="node">`;
            for (let node in data) {
              html += `<option value="` + data[node].node_id + `">` + data[node].title + ` (` + data[node].node_id + `)</option>`;
            }
            html += `
                </select>
              </div>`;

            html += `
              <div class="mb-3">
                <label class="form-label">Key</label>
                <input type="text" name="key" class="form-control" value="" autocomplete="off">
              </div>
              <div class="mb-3">
                <label class="form-label">Value</label>
                <input type="text" name="value" class="form-control" value="" autocomplete="off">
              </div>
            `;
            html += ` <input type="hidden" name="type" value="node">`;
 
            $("#modal-config-add .modal-body").html(html);
          });
        }
      });

      /*
       * Handle the user clicking add on the add config modal
       */
      $('.config-modal-add').unbind("click");
      $('.config-modal-add').click(function (sender) {

        let inputs = $("#modal-config-add .modal-body").find("input");
        let type = "";
        let value = "";
        let key = "";
        let package_name = "";
        let node_id = "";

        for (let input in inputs) {
          switch (inputs[input].name) {
            case "type":
              type = inputs[input].value;
              break;
            case "value":
              value = encodeURI(inputs[input].value);
              break;
            case "key":
              key = inputs[input].value;
              break;
            default:
              break;
          }
        }

        inputs = $("#modal-config-add .modal-body").find("select");
        for (let input in inputs) {
          if (inputs[input].name === "package") {
            package_name = inputs[input].value;
          } else if (inputs[input].name === "node") {
            node_id = inputs[input].value;
          }
        }

        let id = "";
        if ("package" === type) id = package_name;
        else if ("node" === type) id = node_id;

        let url = "/config/";
        url += "?type=" + type;
        url += "&key=" + key;
        url += "&value=" + value;
        if (type !== "global") {
          url += "&id=" + id;
        }

        let data = $.ajax({
          url: url,
          type: "PUT"
        }).fail(function (jqXHR, textStatus, errorThrown) {
          let json = jqXHR.responseJSON;
          addAlert(json.message, json.detail, "ERROR");
          $('.config-modal-add').unbind("click");
          $("#modal-config-add [data-bs-dismiss=modal]").trigger({ type: "click" });
        }).done(function (data, textStatus, jqXHR) {
          $('.config-modal-add').unbind("click");
          $("#modal-config-add [data-bs-dismiss=modal]").trigger({ type: "click" });
          updateConfigsTable();
        });

      });


      $('.config-modal-submit').unbind("click");
      $('.config-modal-submit').click(function (sender) {

        let inputs = $("#modal-config .modal-body").find("input");
        let type = "";
        let value = "";
        let key = "";
        let id = "";

        for (let input in inputs) {
          switch (inputs[input].name) {
            case "type":
              type = inputs[input].value;
              break;
            case "value":
              value = encodeURI(inputs[input].value);
              break;
            case "key":
              key = inputs[input].value;
              break;
            case "id":
              id = inputs[input].value;
              break;
            default:
              break;
          }
        }

        let url = "/config/";
        url += "?type=" + type;
        url += "&key=" + key;
        url += "&value=" + value;
        url += "&id=" + id;

        let data = $.ajax({
          url: url,
          type: "PUT"
        }).fail(function (jqXHR, textStatus, errorThrown) {
          let json = jqXHR.responseJSON;
          addAlert(json.message, json.detail, "ERROR");
          $('.config-modal-submit').unbind("click");
          $("#modal-config [data-bs-dismiss=modal]").trigger({ type: "click" });
        }).done(function (data, textStatus, jqXHR) {
          $('.config-modal-submit').unbind("click");
          $("#modal-config [data-bs-dismiss=modal]").trigger({ type: "click" });
          updateConfigsTable();
        });

      });

    });

  }


  function addAlert(message, detail, state) {

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

  window.confrm_showPage = function(name) {
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

//});

