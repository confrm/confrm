
let drawn_nodes = [];

export function updateNodesTable(clear = false) {

  if (clear === true) {
    drawn_nodes = [];
  }

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
          window.addAlert(json.message, json.detail, "ERROR");
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
          window.addAlert(json.message, json.detail, "ERROR");
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