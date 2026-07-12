(function () {
  const config = window.PROMPT_GHOR_ADS;
  const target = document.getElementById("ad-sidebar-unit");
  if (!target || !config || !config.enabled || !config.client || !config.sidebarSlot) return;

  const source = document.createElement("script");
  source.async = true;
  source.crossOrigin = "anonymous";
  source.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(config.client);
  document.head.appendChild(source);

  const ad = document.createElement("ins");
  ad.className = "adsbygoogle";
  ad.style.display = "block";
  ad.dataset.adClient = config.client;
  ad.dataset.adSlot = config.sidebarSlot;
  ad.dataset.adFormat = "auto";
  ad.dataset.fullWidthResponsive = "true";
  target.appendChild(ad);
  source.addEventListener("load", () => (window.adsbygoogle = window.adsbygoogle || []).push({}));
})();
