let active_package = "";
let drawn_packages = [];

export function updatePackagesTable(clear = false) {

  if (clear === true) {
    drawn_packages = [];
  }

  let data = $.ajax({
    url: "/packages/",
    type: "GET"
  }).then(function (data) {

    let current_packages = [];
    for (let entry in data) {

      let html = "";
      let row = data[entry];

      // Keep track of packages we are drawing this time
      current_packages.push(entry);

      let is_drawn = false;
      for (let package_name in drawn_packages) {
        if (drawn_packages[package_name] === entry) {
          is_drawn = true;
        }
      }


      // Version is a list, process to first element
      let version = "", manage_versions = "";

      if (row["versions"].length == 0) {
        manage_versions = "disabled";
        version = "None";
      } else {
        version = row["versions"][0].number;
      }

      if (!is_drawn) {


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
                  <div class="dropdown-item packages-action-delete" style="cursor:pointer" data-package-name=` + entry + `
                  data-bs-toggle="modal" data-bs-target="#modal-package-confirm" >
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
          } else if ("version" === headings[heading]) {
            if (current !== version) {
              // Version change - redraw page
              redrawPackagesTable();
              return;
            }
          } else if (current !== row[headings[heading]]) {
            $(package_row_id + " .package-" + headings[heading]).html(row[headings[heading]]);
          }

        }
      }
    }

    // If drawn packages has more than current packages - then we have a missmatch...
    if (current_packages.length != drawn_packages.length) {
      redrawPackagesTable();
      return;
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
        url += "&canary_next=false";
        url += "&canary_id=";
      } else if ("canary" === $(".package-deployment-select")[0].value) {
        let inputs = $(".package-deployment-canary").find("input");
        let selection = "";
        url += "&set_active=false";
        for (let input in inputs) {
          if (inputs[input].checked) {
            selection = inputs[input].value;
          }
        }
        if ("next" === selection) {
          url += "&canary_next=true";
          url += "&canary_id=";
        } else {
          let canary = $(".package-deployment-canary-nodes")[0].value;
          url += "&canary_next=false";
          url += "&canary_id=" + canary;
        }
      } else {
        url += "&set_active=false";
        url += "&canary_next=false";
        url += "&canary_id=";
      }

      $.ajax({
        url: url,
        type: "POST",
        data: fd,
        processData: false,  // tell jQuery not to process the data
        contentType: false   // tell jQuery not to set contentType
      }).fail(function (jqXHR, textStatus, errorThrown) {
        let json = jqXHR.responseJSON;
        window.addAlert(json.message, json.detail, "ERROR");
        $(".package-add-submit").unbind("click");
        $("#modal-package-upload [data-bs-dismiss=modal]").trigger({ type: "click" });
      }).done(function (data, textStatus, jqXHR) {
        $(".package-add-submit").unbind("click");
        $("#modal-package-upload [data-bs-dismiss=modal]").trigger({ type: "click" });
        window.confrm_updateMeta(window.confrm_meta);
        redrawPackagesTable();
        let json = jqXHR.responseJSON;
        if ("undefined" !== typeof json.warning) {
          window.addAlert(json.message, json.detail, "WARNING");
        }
        if ("undefined" !== typeof json.info) {
          window.addAlert(json.message, json.detail, "INFO");
        }

      });

      return false;
    });

    $(".packages-action-delete").unbind("click");
    $(".packages-action-delete").click(function (sender) {
      let name = sender.currentTarget.dataset.packageName;

      let html = `Do you wish to delete package "` + name + `"? Doing so will also delete any stored versions and `;
      html += `any configurations for this package. This action cannot be undone.`;
      html += `<input type="hidden" name="package" value="` + name + `">`;

      $("#modal-package-confirm .modal-question").html(html);
    });

    $(".modal-package-confirm-yes").unbind("click");
    $(".modal-package-confirm-yes").click(function () {

      let inputs = $("#modal-package-confirm").find("input");

      let package_name = "";

      for (let input in inputs) {
        let val = inputs[input].value;
        switch (inputs[input].name) {
          case "package":
            package_name = val;
            break;
          default:
            break;
        }
      }

      let url = "/package/";
      url += "?name=" + package_name;

      let data = $.ajax({
        url: url,
        type: "DELETE"
      }).fail(function (jqXHR, textStatus, errorThrown) {
        let json = jqXHR.responseJSON;
        window.addAlert(json.message, json.detail, "ERROR");
        $(".modal-package-confirm-yes").unbind("click");
        $("#modal-package-confirm [data-bs-dismiss=modal]").trigger({ type: "click" });
      }).done(function (data, textStatus, jqXHR) {
        $(".modal-package-confirm-yes").unbind("click");
        $("#modal-package-confirm [data-bs-dismiss=modal]").trigger({ type: "click" });
        redrawPackagesTable();
      });
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
            for (let node in data) {
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
        window.addAlert(json.message, json.detail, "ERROR");
        $(".package-add-submit").unbind("click");
        $("#modal-package-add [data-bs-dismiss=modal]").trigger({ type: "click" });
      }).done(function (data, textStatus, jqXHR) {
        $(".package-add-submit").unbind("click");
        $("#modal-package-add [data-bs-dismiss=modal]").trigger({ type: "click" });
        window.confrm_updateMeta(window.confrm_meta);
      });

    });

  });
}


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
      let package_name = sender.currentTarget.dataset.packageName;
      let version = sender.currentTarget.dataset.version;
      let data = $.ajax({
        url: "/set_active_version/?package=" + package_name + "&version=" + version,
        type: "PUT"
      }).then(function (data) {
        setPackageVersionsModal(package_name);
      });
    });

    $('.packages-delete-version').unbind("click");
    $('.packages-delete-version').click(function (sender) {
      let package_name = sender.currentTarget.dataset.packageName;
      let version = sender.currentTarget.dataset.version;

      let url = "/package_version/?package=" + package_name + "&version=" + version;
      let data = $.ajax({
        url: url,
        type: "DELETE"
      }).fail(function (jqXHR, textStatus, errorThrown) {
        let json = jqXHR.responseJSON;
        window.addAlert(json.message, json.detail, "ERROR");
        setPackageVersionsModal(package_name);
      }).done(function (data, textStatus, jqXHR) {
        setPackageVersionsModal(package_name);
      });

    });

  });
}


function redrawPackagesTable() {
  drawn_packages = [];
  $("#packages-table-body").html("");
  window.confrm_updateMeta(window.confrm_meta);
  updatePackagesTable();
}