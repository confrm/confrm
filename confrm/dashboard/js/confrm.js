
document.addEventListener("DOMContentLoaded", function () {
  // Handler when all assets (including images) are loaded
  let nav_elements = [
    {
      "name": "Dashboard",
      "icon": "gg-organisation",
    },
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
      "name": "Keys",
      "icon": "gg-key"
    }
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

  function drawHelper(name, body) {
    return { [name](...args) { return body(...args) } }[name];
  }

  pages.push(drawHelper("packages", () => {

    $("#page-content").html(templates["packages"]["packages.html"]);

    $("#packages-table-title").html(meta["packages"] + " Packages Installed");

    let data = $.ajax({
      url: "/packages/",
      type: "GET"
    }).then(function (data) {

      let html = "";

      for (let entry in data) {
        let row = data[entry];
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
        html += "<tr>";
        html += `<td>` + row["title"] + ` <span class="text-muted">(` + entry + `)</span></td>`;
        html += `<td>` + row["description"] + `</td>`;
        html += `<td>` + `ENABLED</td>`;
        html += `<td>` + version + `</td>`;
        html += `<td>` + row["platform"] + `</td>`;
        html += `
          <td class="text-end">
            <span class="dropdown">
              <button class="btn dropdown-toggle align-text-top" data-bs-boundary="viewport"
                data-bs-toggle="dropdown">Actions</button>
              <div class="dropdown-menu dropdown-menu-end">
                <div class="dropdown-item packages-action-upload" style="cursor:pointer" 
                  data-bs-toggle="modal" data-bs-target="#modal-package-upload" data-package-name="` + entry + `"
                  data-package-title="` + row.title + `" data-bs-backdrop="static" data-bs-keyboard="false">
                  Upload new version
                </div>
                <div class="dropdown-item packages-info-button ` + manage_versions +`" style="cursor:pointer;" 
                  data-bs-toggle="modal" data-bs-target="#modal-package-info" data-package-name="` + entry + `">
                  Manage versions
                </div>
                <div class="dropdown-item packages-arduino-button" style="cursor:pointer;" data-package-name=` + entry + `>
                  Enable ArduinoIDE Interface
                </div>
                <div class="dropdown-item packages-action-upload" style="cursor:pointer" data-package-name=` + entry + `>
                  Delete package
                </div>
              </div>
            </span>
          </td>`;8
        html += "</tr>";
      }

      $("#packages-table-body").html(html);

      $('.toast').toast({
        autohide: true,
        delay: 5000
      }).toast('hide');

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
          addAlert(json.message, json.detail, false);
          $(".package-add-submit").unbind("click");
          $("[data-bs-dismiss=modal]").trigger({ type: "click" });
        }).done(function (data, textStatus, jqXHR) {
          $(".package-add-submit").unbind("click");
          $("[data-bs-dismiss=modal]").trigger({ type: "click" });
          updateMeta(meta);
          showPage("packages");
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
          addAlert(json.message, json.detail, false);
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


  pages.push(drawHelper("nodes", () => {

    $("#page-content").html(templates["nodes"]["nodes.html"]);
  
    $("#node-table-title").html(meta["nodes"] + " Nodes Registered");
  
    let data = $.ajax({
      url: "/nodes/",
      type: "GET"
    }).then(function (data) {

      let html = "";

      for (let entry in data) {
        let row = data[entry];
        // Version is a list, process to first element + info mark
        let version = "";
        if (row["versions"].length === 0) {
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
        html += "<tr>";
        html += `<td>` + row["title"] + ` <span class="text-muted">(` + entry + `)</span></td>`;
        html += `<td>` + row["description"] + `</td>`;
        html += `<td>` + version + `</td>`;
        html += `<td>` + row["platform"] + `</td>`;
        html += `
          <td class="text-end">
            <span class="dropdown">
              <button class="btn dropdown-toggle align-text-top" data-bs-boundary="viewport"
                data-bs-toggle="dropdown">Actions</button>
              <div class="dropdown-menu dropdown-menu-end">
                <div class="dropdown-item packages-action-upload" style="cursor:pointer" 
                  data-bs-toggle="modal" data-bs-target="#modal-package-upload" data-package-name="` + entry + `"
                  data-package-title="` + row.title + `" data-bs-backdrop="static" data-bs-keyboard="false">
                  Upload new version
                </div>
                <div class="dropdown-item packages-info-button" style="cursor:pointer" 
                  data-bs-toggle="modal" data-bs-target="#modal-package-info" data-package-name="` + entry + `">
                  Manage versions
                </div>
                <div class="dropdown-item packages-action-upload" style="cursor:pointer" data-package-name=` + entry + `>
                  Delete package
                </div>
              </div>
            </span>
          </td>`;
        html += "</tr>";
      }

      $("#packages-table-body").html(html);

    });
  }));

  function addAlert(message, detail, success) {

    let type = "alert-danger";
    if (success) {
      type = "alert-success";
    }

    let html = `
      <div class="alert ` + type + ` alert-dismissible" role="alert">
      <h3 class="mb-1">` + message + `</h3>
      <p>` + detail + `</p>
      <div class="btn-list">
        <a href="#" class="btn btn-success" data-bs-dismiss="alert">Okay</a>
      </div>
      <a class="btn-close" data-bs-dismiss="alert" aria-label="close"></a>
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

});

