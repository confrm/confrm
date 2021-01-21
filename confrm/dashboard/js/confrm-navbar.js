export function drawNavbar(nav_elements) {

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
      window.confrm_templates[element_name] = [];
      for (let template in template_list) {
        fetch("/static/templates/" + template_list[template])
          .then(function (response) {
            return response.text();
          })
          .then(function (data) {
            window.confrm_templates[element_name][template_list[template]] = data;
          })
      }
    }
  }
  html += '</ul>';
  $("#navbar-menu").html(html);
  $(".nav-link").click(function (e) {
    let page_name = e.currentTarget.dataset["page"];
    window.confrm_current_page = page_name;
    window.confrm_updateMeta(window.confrm_meta);
    window.confrm_showPage(page_name);
  });

}