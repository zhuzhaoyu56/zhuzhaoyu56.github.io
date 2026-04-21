(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function parseValue(input, raw) {
    if (input.type === "number" || input.type === "range") {
      return parseFloat(raw);
    }
    if (input.tagName === "SELECT") {
      if (raw === "true") return true;
      if (raw === "false") return false;
      if (raw !== "" && !Number.isNaN(Number(raw))) return parseFloat(raw);
      return raw;
    }
    return raw;
  }

  function bindInputs() {
    const inputs = document.querySelectorAll("[data-bind]");
    inputs.forEach((input) => {
      const path = input.getAttribute("data-bind");
      const value = utils.getPath(PVSim.state.getSnapshot(), path);
      if (value !== undefined) {
        if (input.type === "checkbox") {
          input.checked = Boolean(value);
        } else {
          input.value = value;
        }
      }

      input.addEventListener("input", () => {
        const nextValue = input.type === "checkbox" ? input.checked : parseValue(input, input.value);
        PVSim.state.set(path, nextValue);
      });

      input.addEventListener("change", () => {
        const nextValue = input.type === "checkbox" ? input.checked : parseValue(input, input.value);
        PVSim.state.set(path, nextValue);
      });
    });
  }

  function bindAccordions() {
    document.querySelectorAll(".panel-section[data-accordion]").forEach((section) => {
      const openByDefault = section.getAttribute("data-accordion") === "open";
      section.setAttribute("aria-expanded", openByDefault ? "true" : "false");
      const header = section.querySelector(".section-header");
      header.addEventListener("click", () => {
        const expanded = section.getAttribute("aria-expanded") === "true";
        section.setAttribute("aria-expanded", expanded ? "false" : "true");
      });
    });
  }

  function bindTabs() {
    const tabs = document.querySelectorAll("[data-tabs] .tab");
    const panels = document.querySelectorAll("[data-tab-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.getAttribute("data-tab");
        panels.forEach((panel) => {
          panel.classList.toggle("active", panel.getAttribute("data-tab-panel") === target);
        });
        PVSim.bus.emit("ui:tab", target);
      });
    });
  }

  function bindActions() {
    document.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.getAttribute("data-action");
      if (action.startsWith("import")) return;
      button.addEventListener("click", () => {
        PVSim.bus.emit(`action:${action}`, {});
      });
    });

    document.querySelectorAll("input[data-action='import-weather']").forEach((input) => {
      input.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
          PVSim.bus.emit("action:import-weather", file);
        }
      });
    });

    document.querySelectorAll("input[data-action='import-load']").forEach((input) => {
      input.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
          PVSim.bus.emit("action:import-load", file);
        }
      });
    });
  }

  function syncInputsOnState() {
    PVSim.bus.on("state:change", ({ path, value }) => {
      document.querySelectorAll(`[data-bind='${path}']`).forEach((input) => {
        if (input.type === "checkbox") {
          input.checked = Boolean(value);
        } else {
          input.value = value;
        }
      });
    });

    PVSim.bus.on("state:reset", (snapshot) => {
      Object.keys(utils.flatten(snapshot)).forEach((path) => {
        const value = utils.getPath(snapshot, path);
        document.querySelectorAll(`[data-bind='${path}']`).forEach((input) => {
          if (input.type === "checkbox") {
            input.checked = Boolean(value);
          } else {
            input.value = value;
          }
        });
      });
    });
  }

  PVSim.ui = PVSim.ui || {};
  PVSim.ui.controls = {
    init() {
      bindInputs();
      bindActions();
      bindAccordions();
      bindTabs();
      syncInputsOnState();
    },
  };
})();
