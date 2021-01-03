
document.addEventListener("DOMContentLoaded", function () {
  // Handler when all assets (including images) are loaded
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
      "templates": []
    },
  ];

  // For storing draw methods
  let pages = [];

  // For page tracking
  let current_page = nav_elements[0].name;

  // For storing templates
  let templates = [];

  // General metadata
  let meta = {};
  updateMeta(meta);

  // For messaging to form elements
  var active_package = "";

  // For storing which up elements have been drawn
  drawn_nodes = [];
  drawn_packages = [];

  // Call the update function every 1200ms
  setInterval(updateUIEvent, 1200);

  /* Populate the navbar */
  let html = '<ul class="navbar-nav pt-lg-3">';
  for (let nav_element in nav_elements) {
    let element_title = nav_elements[nav_element]["name"];
    let element_name = element_title.toLowerCase();
    let element_icon = nav_elements[nav_element]["icon"];
    html += `
      <li class="nav-item">
        <div class="nav-link" style="cursor:pointer" data-page="` + element_name + `">
          <span class="nav-link-icon d-md-none d-lg-inline-block"><svg xmlns="http://www.w3.org/2000/svg"
              class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
              fill="none" stroke-linecap="round" stroke-linejoin="round">
              <use xlink:href="/static/img/all.svg#` + element_icon + `"/>
              </svg>
          </span>
          <span class="nav-link-title">
            ` + element_title + `
          </span>
        </div>
      </li>`;
    if ("undefined" !== typeof nav_elements[nav_element]["templates"]) {
      let template_list = nav_elements[nav_element]["templates"];
      templates[element_name] = [];
      for (let template in template_list) {
        fetch("/static/templates/" + template_list[template])
          .then(function (response) {
            return response.text();
          })
          .then(function (data) {
            templates[element_name][template_list[template]] = data;
          })
      }
    }
  }
  html += '</ul>';
  $("#navbar-menu").html(html);
  $(".nav-link").click(function (e) {
    let page_name = e.currentTarget.dataset["page"];
    current_page = page_name;
    updateMeta(meta);
    showPage(page_name);
  });

  setTimeout(function () {
    current_page = "packages";
    showPage("packages");
  }, 200);

  function drawHelper(name, body) {
    return { [name](...args) { return body(...args) } }[name];
  }

  pages.push(drawHelper("packages", () => {

    $("#page-content").html(templates["packages"]["packages.html"]);

    $("#packages-table-title").html(meta["packages"] + " Packages Installed");

    drawn_packages = [];

    updatePackagesTable();

  }));


  pages.push(drawHelper("nodes", () => {

    $("#page-content").html(templates["nodes"]["nodes.html"]);

    $("#node-table-title").html(meta["nodes"] + " Nodes Registered");

    // This list is used to track which nodes are currently drawn on the screen.
    // As this method is being called we can assume that this should be cleared
    // pending an update when updateNodeTables is called.
    drawn_nodes = [];

    updateNodesTable();

  }));


  function setPackageVersionsModal(name) {
    let data = $.ajax({
      url: "/package/?name=" + name,
      type: "GET"
    }).then(function (data) {
      let title = data["title"];
      let body = `
        <table class="table card-table table-vcenter text-nowrap datatable">
          <thead>
            <tr>
              <th>Version</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="packages-table-body">
      `;

      for (let ver in data["versions"]) {

        let is_active = data["versions"][ver].number === data["current_version"];
        let number = data["versions"][ver].number;
        let date = data["versions"][ver].date
        let name = data["name"];

        body += `
          <tr>
            <td>` + number + `</td>
            <td>` + date + `</td>
            <td class="text-end" align="right">
            <span class="dropdown">
              <button class="btn dropdown-toggle align-text-top" data-bs-boundary="viewport"
                data-bs-toggle="dropdown">Actions</button>
              <div class="dropdown-menu dropdown-menu-end style="cursor:pointer">
                <div class="dropdown-item packages-delete-version" data-version="` + number + `" 
                data-package-name="` + name + `">
                  Delete Version
                </div>
        `;
        if (false === is_active) {
          body += `
            <div class="dropdown-item packages-set-active" data-version="` + number + `" 
            data-package-name="` + name + `" style="cursor:pointer">
            Set as Active
            </div>`;
        }
        body += `
              </div>
            </span>
            </td>
          </tr>
        `
      }

      body += `
          </tbody>
        </table>`;

      $("#modal-package-info .modal-title").html(title);
      $("#modal-package-info .modal-body").html(body);

      $('.packages-set-active').unbind("click");
      $('.packages-set-active').click(function (sender) {
        let package = sender.currentTarget.dataset.packageName;
        let version = sender.currentTarget.dataset.version;
        let data = $.ajax({
          url: "/set_active_version/?name=" + name + "&version=" + version,
          type: "PUT"
        }).then(function (data) {
          setPackageVersionsModal(name);
        });
      });

      $('.packages-delete-version').unbind("click");
      $('.packages-delete-version').click(function (sender) {
        let package = sender.currentTarget.dataset.packageName;
        let version = sender.currentTarget.dataset.version;
        let data = $.ajax({
          url: "/package_version/?name=" + name + "&version=" + version,
          type: "DELETE"
        }).then(function (data) {
          setPackageVersionsModal(name);
        });
      });

    });
  }



  function updatePackagesTable() {
    let data = $.ajax({
      url: "/packages/",
      type: "GET"
    }).then(function (data) {

      let html = "";

      for (let entry in data) {
        let row = data[entry];

        let is_drawn = false;
        for (let package in drawn_packages) {
          if (drawn_packages[package] === entry) {
            is_drawn = true;
          }
        }

        if (!is_drawn) {

          // Version is a list, process to first element + info mark
          let version = "", manage_versions = "";
          if (row["versions"].length == 0) {
            manage_versions = "disabled";
            version = "None";
          } else if (row["versions"].length == 1) {
            version = row["versions"][0].number;
          } else if (row["versions"].length > 1) {
            version = row["versions"][0].number +
              `&nbsp;
                <svg class="icon packages-info-button" style="cursor:pointer" width="24" height="24" viewBox="0 0 24 24"
                data-bs-toggle="modal" data-bs-target="#modal-package-info" data-package-name="` + entry + `">
                  <use xlink:href="/static/img/all.svg#gg-info"/>
                </svg>`;
          }
          html += `<tr id="package-` + entry + `">`;
          html += `<td class="package-title">` + row["title"] + ` <span class="text-muted">(` + entry + `)</span></td>`;
          html += `<td class="package-description">` + row["description"] + `</td>`;
          html += `<td class="package-version">` + version + `</td>`;
          html += `<td class="package-platform">` + row["platform"] + `</td>`;
          html += `
              <td class="text-end">
                <span class="dropdown">

                  <button class="btn dropdown-toggle align-text-top"  data-bs-boundary="viewport"
                    data-bs-toggle="dropdown">Actions</button>
                  <div class="dropdown-menu dropdown-menu-end">
                    <div class="dropdown-item packages-action-upload" style="cursor:pointer" 
                      data-bs-toggle="modal" data-bs-target="#modal-package-upload" data-package-name="` + entry + `"
                      data-package-title="` + row.title + `" data-bs-backdrop="static" data-bs-keyboard="false">
                      Upload new version
                    </div>
                    <div class="dropdown-item packages-info-button ` + manage_versions + `" style="cursor:pointer;" 
                      data-bs-toggle="modal" data-bs-target="#modal-package-info" data-package-name="` + entry + `">
                      Manage versions
                    </div>
                    <!--
                    <div class="dropdown-item packages-arduino-button" style="cursor:pointer;" data-package-name=` + entry + `>
                      Enable ArduinoIDE Interface
                    </div>
                    -->
                    <div class="dropdown-item packages-action-upload" style="cursor:pointer" data-package-name=` + entry + `>
                      Delete package
                    </div>
                  </div>
                </span>
              </td>`;
          html += "</tr>";


          $("#packages-table-body").append(html);
          drawn_packages.push(entry);

        } else {
          let headings = ["title", "description", "version", "platform"];
          let package_row_id = "#package-" + entry;
          for (let heading in headings) {
            let current = $(package_row_id + " .package-" + headings[heading]).html();
            let element_type = typeof row[headings[heading]];
            if ("number" === element_type) {
              current = parseInt(current);
            }
            if ("title" === headings[heading]) {
              let titleHtml = row["title"] + ` <span class="text-muted">(` + entry + `)</span>`;
              if (current !== titleHtml) {
                $(package_row_id + " .package-" + headings[heading]).html(titleHtml);
              }
            } else if (current !== row[headings[heading]]) {
              $(package_row_id + " .package-" + headings[heading]).html(row[headings[heading]]);
            }

          }
        }
      }

      $(".packages-info-button").unbind('click');
      $(".packages-info-button").click(function (sender) {
        let name = sender.currentTarget.dataset.packageName;
        setPackageVersionsModal(name);
      });

      $(".packages-arduino-button").unbind('click');
      $(".packages-arduino-button").click(function (sender) {
        let name = sender.currentTarget.dataset.packageName;
        setPackageVersionsModal(name);
      });

      $(".packages-action-upload").unbind('click');
      $(".packages-action-upload").click(function (sender) {
        let name = sender.currentTarget.dataset.packageName;
        let title = sender.currentTarget.dataset.packageTitle;
        active_package = name;
        $("#modal-package-upload .modal-title").html(title);
        // Get up to date information for the UI
        let data = $.ajax({
          url: "/package/?name=" + name,
          type: "GET"
        }).then(function (data) {
          let html = '';
          if ("" !== data.current_version) {
            html += "Version Number (Active version is " + data.current_version;
            if (data.latest_version !== "" && data.current_version != data.latest_version) {
              html += ", latest version is " + data.latest_version;
            }
            html += ")";
          } else {
            html += "No versions currently exist for this package"
          }
          $('.modal-package-version-info').html(html);
        });


        // Reset the form contents
        $(".package-upload-version").find("input").each(function (id, input) {
          input.classList.remove("is-valid");
          input.classList.remove("is-invalid");
          input.value = "";
        });
        $("#package-upload-file")[0].value = "";
        $(".package-deployment-select")[0].value = "immediate";
        $(".package-deployment-canary-nodes").hide();
      });

      $(".package-upload-submit").unbind("click");
      $(".package-upload-submit").click(function () {
        // TODO: get deployment method selected
        let version_parts = $(".package-upload-version").find("input");
        let major = 0, minor = 0, revision = 0;

        let valid = true;
        for (let i = 0; i < version_parts.length; i++) {
          let part = version_parts[i];
          let value = parseInt(part.value);
          if (isNaN(value) || value < 0) {
            part.classList.remove("is-valid");
            part.classList.remove("is-invalid");
            part.classList.add("is-invalid");
            valid = false;
          } else {
            part.classList.remove("is-invalid");
            part.classList.remove("is-valid");
            part.classList.add("is-valid");
          }
          switch (part.name) {
            case "major":
              major = value;
              break;
            case "minor":
              minor = value;
              break;
            case "revision":
              revision = value;
              break;
            default:
              break;
          }
        }

        if (!valid) {
          return; // Don't do it
        }

        var fd = new FormData();
        fd.append('file', $("#package-upload-file")[0].files[0]);

        let url = "/package_version/?" +
          "name=" + active_package +
          "&major=" + major +
          "&minor=" + minor +
          "&revision=" + revision;

        if ("immediate" === $(".package-deployment-select")[0].value) {
          url += "&set_active=true";
        } else {
          url += "&set_active=false";
        }

        $.ajax({
          url: url,
          type: "POST",
          data: fd,
          processData: false,  // tell jQuery not to process the data
          contentType: false   // tell jQuery not to set contentType
        }).fail(function (jqXHR, textStatus, errorThrown) {
          let json = jqXHR.responseJSON;
          addAlert(json.message, json.detail, "ERROR");
          $(".package-add-submit").unbind("click");
          $("[data-bs-dismiss=modal]").trigger({ type: "click" });
        }).done(function (data, textStatus, jqXHR) {
          $(".package-add-submit").unbind("click");
          $("[data-bs-dismiss=modal]").trigger({ type: "click" });
          updateMeta(meta);
          showPage("packages");
          let json = jqXHR.responseJSON;
          if ("undefined" !== typeof json.warning) {
            addAlert(json.message, json.detail, "WARNING");
          }
          if ("undefined" !== typeof json.info) {
            addAlert(json.message, json.detail, "INFO");
          }
        });

        return false;
      });

      $(".package-deployment-select").unbind('click');
      $(".package-deployment-select").click(function (sender) {
        let selection = sender.currentTarget.value;
        if ("canary" === selection) {

          let data = $.ajax({
            url: "/nodes/?package=" + active_package,
            type: "GET"
          }).then(function (data) {

            let html = '';
            let options = '';
            let disabled = '';
            if (data.length > 0) {
              options = `<br /><select class="form-select package-deployment-canary-nodes" style="display: none">`;
              for (node in data) {
                let nid = data[node].node_id;
                options += `<option value="` + nid + `">` + nid + `</option>`;
              }
              options += `</select>`;
            } else {
              options = "No nodes registered as using this package";
              disabled = `disabled="true"`;
            }

            html += `
                <label class="form-label">Canary Options</label>
                <div class="form-selectgroup-boxes row mb-3 package-deploymnet-canary-options">
                  <div class="col-lg-6">
                    <label class="form-selectgroup-item">
                      <input type="radio" name="canary-type" value="next" class="form-selectgroup-input" checked>
                      <span class="form-selectgroup-label d-flex align-items-center p-3">
                        <span class="me-3">
                          <span class="form-selectgroup-check"></span>
                        </span>
                        <span class="form-selectgroup-label-content">
                          <span class="form-selectgroup-title strong mb-1">Next Node</span>
                          <span class="d-block text-muted">Update will be deployed to the next node that checks for updates.</span>
                        </span>
                      </span>
                    </label>
                  </div>
                  <div class="col-lg-6" class="package-deployment-canary-select">
                    <label class="form-selectgroup-item">
                      <input type="radio" name="canary-type" value="selected" class="form-selectgroup-input" ` + disabled + `>
                      <span class="form-selectgroup-label d-flex align-items-center p-3">
                        <span class="me-3">
                          <span class="form-selectgroup-check"></span>
                        </span>
                        <span class="form-selectgroup-label-content">
                          <span class="form-selectgroup-title strong mb-1">Specific Node</span>
                          <span class="d-block text-muted">Nominate a node to be updated:</span>
                          ` + options + `
                        </span>
                      </span>
                    </label>
                  </div>
                </div>`;

            html += `<strong>Note:</strong> You will need to manually set the active version to update remaining nodes.`;

            $(".package-deployment-canary").html(html);

            // Forces the default canary option
            $(".package-deploymnet-canary-options").find(".form-selectgroup-input")[0].checked = true;

            $(".package-deploymnet-canary-options").unbind("click");
            $(".package-deploymnet-canary-options").click(function (sender) {
              let options = $(".package-deploymnet-canary-options").find(".form-selectgroup-input");
              if (options[1].checked) {
                $(".package-deployment-canary-nodes").show();
              } else {
                $(".package-deployment-canary-nodes").hide();
              }
            });
          });

        } else {
          $(".package-deployment-canary").html("");
        }

      });

      $(".package-add-submit").unbind("click");
      $(".package-add-submit").click(function () {
        let elements = $("#modal-package-add").find("input");

        let name = "", title = "", description = "", platform = "";

        for (let element in elements) {
          let value = encodeURI(elements[element].value);
          switch (elements[element].name) {
            case "name":
              name = value;
              const regex = /^[0-9a-zA-Z_-]+$/gm;
              if (regex.exec(name) === null) {
                name_element = $("#package-add-input-name");
                name_element.removeClass("is-invalid");
                name_element.removeClass("is-valid");
                name_element.addClass("is-invalid");
                return;
              }
              break;
            case "title":
              title = value;
              break;
            case "description":
              description = value;
              break;
            case "platform":
              platform = value;
              break;
            default:
              break;
          }
        }

        let url = "/package/";
        url += "?name=" + name;
        url += "&title=" + title;
        url += "&description=" + description;
        url += "&platform=" + platform;

        let data = $.ajax({
          url: url,
          type: "PUT"
        }).fail(function (jqXHR, textStatus, errorThrown) {
          let json = jqXHR.responseJSON;
          addAlert(json.message, json.detail, "ERROR");
          $(".package-add-submit").unbind("click");
          $("[data-bs-dismiss=modal]").trigger({ type: "click" });
        }).done(function (data, textStatus, jqXHR) {
          $(".package-add-submit").unbind("click");
          $("[data-bs-dismiss=modal]").trigger({ type: "click" });
          updateMeta(meta);
          showPage("packages");
        });

      });

    });
  }

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

          let html = `<select class="form-select nodes-change-package-selection">`;
          for (let package in data) {
            html += `<option value="` + data[package].name + `"`;
            if (data[package].name === current_package) {
              html += ` selected`;
            }
            html += `">` + data[package].title + ` (` + data[package].name + `)</option>`
          }
          html += `</select>`;
          html += ` <input type="hidden" name="type" value="package">`;

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

        switch(type) {
          case "title":

            let title = "", node_id = "";

            for (let input in inputs) {
              if ("node_id" === inputs[input].name) {
                node_id = inputs[input].value;
              } else if("title" === inputs[input].name) {
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
              $("[data-bs-dismiss=modal]").trigger({ type: "click" });
            }).done(function (data, textStatus, jqXHR) {
              $(".nodes-modal-submit").unbind("click");
              $("[data-bs-dismiss=modal]").trigger({ type: "click" });
            });

            break;
          case "platform":
            break;
          default:
            break;
        }

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

  function updateMeta(meta) {
    let data = $.ajax({
      url: "/info/",
      type: "GET"
    }).then((function (data) {
      for (let key in data) {
        meta[key] = data[key];
      }
      if ("packages" === current_page) {
        $("#packages-table-title").html(meta["packages"] + " Packages Installed");
      } else if ("nodes" == current_page) {
        $("#node-table-title").html(meta["nodes"] + " Nodes Registered");
      }
    }).bind(meta));
  }

  function showPage(name) {
    for (let page in pages) {
      if (pages[page].name === name) {
        pages[page]();
      }
    }
  }

  function updateUIEvent() {
    if ("nodes" === current_page) {
      updateNodesTable();
    } else if ("packages" === current_page) {
      updatePackagesTable();
    }
  }

});

