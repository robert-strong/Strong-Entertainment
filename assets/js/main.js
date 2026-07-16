// Mobile nav toggle + dropdown handling
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Keyboard/touch support for the "More" dropdown
  document.querySelectorAll('.nav-item--dropdown').forEach(function (item) {
    var btn = item.querySelector('.nav-more');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function () {
    document.querySelectorAll('.nav-item--dropdown.open').forEach(function (i) {
      i.classList.remove('open');
    });
  });
})();
