{
  const toggleEl = document.querySelector('#color-scheme-toggle');
  const DARK = 'dark';
  const LIGHT = 'light';
  const COLOR_SCHEME_CHANGED = 'colorSchemeChanged';

  toggleEl.addEventListener(COLOR_SCHEME_CHANGED, (e) => {
    const isDark = e.detail === DARK;
    const imgEl = document.querySelector(`#profilePhoto`);
    const mode = [DARK, LIGHT];

    if (isDark) mode.reverse();
    imgEl.src = imgEl.src.replace(mode[0], mode[1]);
  });

  // var text = ["rajeev erramilli","//rajeev.erramil.li/","rajeev => erramilli"];
  // var counter = 0;
  // var elem = $("#title");
  // setInterval(change, 3000);
  // function change() {
  //   elem.fadeOut(function(){
  //       elem.html(text[counter]);
  //       counter++;
  //       if(counter >= text.length) { counter = 0; }
  //       elem.fadeIn();
  //   });
  // }
}
