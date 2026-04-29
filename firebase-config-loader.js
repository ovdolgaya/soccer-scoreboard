// ============================================
// FIREBASE CONFIG LOADER
// ============================================
// Reads fcEnv from localStorage ('prod' | 'test') and
// synchronously loads the matching firebase-config.js via
// document.write — must be included BEFORE any Firebase SDK use.
//
// App pages (with auth):   <script src="firebase-config-loader.js"></script>
// Widget pages (no auth):  <script src="firebase-config-loader.js?widget"></script>

(function () {
    const env      = localStorage.getItem('fcEnv') || 'prod';
    const isWidget = document.currentScript &&
                     document.currentScript.src.indexOf('widget') !== -1;

    const file = isWidget
        ? (env === 'test' ? 'firebase-config-widget-test.js' : 'firebase-config-widget.js')
        : (env === 'test' ? 'firebase-config-test.js'        : 'firebase-config.js');

    document.write('<script src="' + file + '"><\/script>');
})();
