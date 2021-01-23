let drawn_configs = [];

export function updateConfigsTable(clear = false) {


  if (clear === true) {
    drawn_configs = [];
  }

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
      } else if ("node" === row.type && "undefined" !== typeof row.node_title) {
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
        window.addAlert(json.message, json.detail, "ERROR");
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
        window.addAlert(json.message, json.detail, "ERROR");
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
        window.addAlert(json.message, json.detail, "ERROR");
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