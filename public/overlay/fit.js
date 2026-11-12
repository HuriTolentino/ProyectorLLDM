(() => {
  const baseSizes = new WeakMap();
  const selector = '.main-title, .hymn-num, .hymn-title, .bible-book, .bible-verse, .category-tag, .sub-detail, .drone-tag, .drone-title, .minister-name, .minister-location';
  function fit(container, maxHeight, textScale = 1) {
    const viewport = window.OutputViewport;
    const scale = viewport.scale();
    const elements = [...container.querySelectorAll(selector)];
    for (const element of elements) {
      if (!baseSizes.has(element)) baseSizes.set(element, parseFloat(getComputedStyle(element).fontSize) / scale);
      element.style.fontSize = viewport.length(baseSizes.get(element) * textScale);
    }
    // Measure the real font and available width, rather than truncating by character count.
    for (let factor = .975; factor >= .45; factor -= .025) {
      const overflows = container.scrollHeight > maxHeight * scale + 1 || container.scrollWidth > container.clientWidth + 1
        || elements.some(element => element.scrollWidth > element.clientWidth + 1);
      if (!overflows) break;
      for (const element of elements) {
        const minimum = element.matches('.category-tag, .sub-detail, .drone-tag, .minister-location') ? 12 : 18;
        const preferred = baseSizes.get(element) * textScale;
        element.style.fontSize = viewport.length(Math.max(Math.min(minimum, preferred), preferred * factor));
      }
    }
  }
  function reset(container) {
    for (const element of container.querySelectorAll(selector)) {
      baseSizes.delete(element);
      element.style.removeProperty('font-size');
    }
  }
  window.LldmOverlayLayout = Object.freeze({ fit, reset });
})();
