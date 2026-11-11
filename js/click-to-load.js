// Replaces a placeholder (.video-consent[data-video-src]) with the real iframe only
// after the visitor clicks, so no request is made to the video host before that.
(function () {
  "use strict";
  var boxes = document.querySelectorAll(".video-consent[data-video-src]");
  Array.prototype.forEach.call(boxes, function (box) {
    var button = box.querySelector("button");
    if (!button) return;
    button.addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.src = box.getAttribute("data-video-src");
      frame.title = box.getAttribute("data-video-title") || "Embedded video";
      frame.width = "560";
      frame.height = "315";
      frame.style.cssText = "margin:auto;display:block;border:0;max-width:100%";
      frame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      frame.setAttribute("allowfullscreen", "");
      frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      box.parentNode.replaceChild(frame, box);
    });
  });
})();
