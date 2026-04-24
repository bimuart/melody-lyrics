import { computed, onMounted, ref, watch } from "vue";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "melody-check-theme";

function getStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

export function useTheme() {
  const preference = ref<ThemePreference>(getStored());

  const resolvedDark = computed(() => preference.value === "dark");

  function applyDom() {
    const root = document.documentElement;
    if (resolvedDark.value) root.setAttribute("data-theme", "dark");
    else root.setAttribute("data-theme", "light");
  }

  function setPreference(v: ThemePreference) {
    preference.value = v;
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  }

  onMounted(() => {
    applyDom();
  });

  watch([resolvedDark], applyDom, { immediate: true });

  return {
    preference,
    resolvedDark,
    setPreference,
    cyclePreference() {
      const order: ThemePreference[] = ["light", "dark"];
      const i = order.indexOf(preference.value);
      setPreference(order[(i + 1) % order.length]);
    },
  };
}
