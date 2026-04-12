const WelcomeModal = (() => {
  const WELCOMED_KEY = 'vd_welcomed';
  const SAVED_STATE_KEY = 'vd_canvas';

  const show = () => {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  };

  const hide = () => {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  const loadTemplate = async (templateName) => {
    try {
      const response = await fetch(`/templates/${templateName}-template.json`);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.statusText}`);
      }
      const templateData = await response.json();

      // Load template into state
      if (window.State && window.State.loadFromJSON) {
        State.loadFromJSON(templateData);
      }

      // Mark as welcomed and hide modal
      localStorage.setItem(WELCOMED_KEY, 'true');
      hide();

      // Show success message
      if (window.showToast) {
        showToast(`Loaded ${templateName} template`, 'success');
      }
    } catch (error) {
      console.error('Template load error:', error);
      if (window.showToast) {
        showToast(`Failed to load template: ${error.message}`, 'error');
      }
    }
  };

  const init = () => {
    // Template card click handlers
    const templateCards = document.querySelectorAll('.template-card');
    templateCards.forEach(card => {
      card.addEventListener('click', () => {
        const templateName = card.getAttribute('data-template');
        if (templateName) {
          loadTemplate(templateName);
        }
      });

      // Also attach handler to the button inside
      const btn = card.querySelector('.btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const templateName = card.getAttribute('data-template');
          if (templateName) {
            loadTemplate(templateName);
          }
        });
      }
    });

    // Start blank canvas button
    const startBlankBtn = document.getElementById('start-blank-btn');
    if (startBlankBtn) {
      startBlankBtn.addEventListener('click', () => {
        localStorage.setItem(WELCOMED_KEY, 'true');
        hide();
      });
    }
  };

  return {
    show,
    hide,
    init,
    loadTemplate
  };
})();
