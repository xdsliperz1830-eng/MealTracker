const STORAGE_KEY = "mealtracker.meals.v1";
const GOAL_KEY = "mealtracker.goal.v1";

const form = document.getElementById("meal-form");
const filterDateInput = document.getElementById("filter-date");
const listEl = document.getElementById("meal-list");
const emptyEl = document.getElementById("empty-state");
const totalCalsEl = document.getElementById("total-calories");
const totalProteinEl = document.getElementById("total-protein");
const totalCarbsEl = document.getElementById("total-carbs");
const totalFatEl = document.getElementById("total-fat");
const goalInput = document.getElementById("calorie-goal");
const goalStatusEl = document.getElementById("goal-status");
const goalProgressEl = document.getElementById("goal-progress");
const avgCalsEl = document.getElementById("avg-calories");
const avgProteinEl = document.getElementById("avg-protein");
const avgCarbsEl = document.getElementById("avg-carbs");
const avgFatEl = document.getElementById("avg-fat");
const chartEl = document.getElementById("week-chart");
const exportBtn = document.getElementById("export-btn");
const importInput = document.getElementById("import-input");
const dataStatusEl = document.getElementById("data-status");

let editingId = null;

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weekdayLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
}

function loadMeals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMeals(meals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
}

function loadGoal() {
  const n = Number(localStorage.getItem(GOAL_KEY));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function saveGoal(n) {
  if (n > 0) localStorage.setItem(GOAL_KEY, String(n));
  else localStorage.removeItem(GOAL_KEY);
}

function round(n, places = 1) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

function formatNumber(n, places = 1) {
  if (!Number.isFinite(n)) n = 0;
  const r = round(n, places);
  return Number.isInteger(r) ? String(r) : r.toFixed(places);
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nutritionForDate(meals, date) {
  return meals
    .filter((m) => m.date === date)
    .reduce(
      (acc, m) => {
        const s = m.servings || 1;
        acc.calories += m.calories * s;
        acc.protein += m.protein * s;
        acc.carbs += m.carbs * s;
        acc.fat += m.fat * s;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

function buildMealRow(meal) {
  const li = document.createElement("li");
  li.className = "meal-item";

  const info = document.createElement("div");
  info.className = "meal-info";

  const name = document.createElement("span");
  name.className = "meal-name";
  const typeBadge = document.createElement("span");
  typeBadge.className = "meal-type";
  typeBadge.textContent = meal.type;
  name.appendChild(typeBadge);
  name.appendChild(document.createTextNode(meal.name));

  const s = meal.servings || 1;
  const meta = document.createElement("span");
  meta.className = "meal-meta";
  meta.textContent =
    `${formatNumber(meal.calories * s, 0)} kcal · ` +
    `${formatNumber(meal.protein * s)}g P · ` +
    `${formatNumber(meal.carbs * s)}g C · ` +
    `${formatNumber(meal.fat * s)}g F` +
    (s !== 1 ? ` · ${formatNumber(s, 2)} servings` : "");

  info.appendChild(name);
  info.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "meal-actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "btn-link";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => {
    editingId = meal.id;
    render();
  });

  const del = document.createElement("button");
  del.type = "button";
  del.className = "delete-btn";
  del.textContent = "Delete";
  del.addEventListener("click", () => deleteMeal(meal.id));

  actions.appendChild(edit);
  actions.appendChild(del);

  li.appendChild(info);
  li.appendChild(actions);
  return li;
}

function buildEditRow(meal) {
  const li = document.createElement("li");
  li.className = "meal-item editing";

  const formEl = document.createElement("form");
  formEl.className = "edit-form";

  formEl.innerHTML = `
    <div class="row">
      <label>Food name<input name="name" type="text" required value="${escapeAttr(meal.name)}" /></label>
      <label>Meal type
        <select name="type" required>
          <option value="breakfast"${meal.type === "breakfast" ? " selected" : ""}>Breakfast</option>
          <option value="lunch"${meal.type === "lunch" ? " selected" : ""}>Lunch</option>
          <option value="dinner"${meal.type === "dinner" ? " selected" : ""}>Dinner</option>
          <option value="snack"${meal.type === "snack" ? " selected" : ""}>Snack</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>Date<input name="date" type="date" required value="${meal.date}" /></label>
      <label>Servings<input name="servings" type="number" min="0.25" step="0.25" required value="${meal.servings}" /></label>
    </div>
    <div class="row">
      <label>Calories<input name="calories" type="number" min="0" step="1" required value="${meal.calories}" /></label>
      <label>Protein (g)<input name="protein" type="number" min="0" step="0.1" required value="${meal.protein}" /></label>
      <label>Carbs (g)<input name="carbs" type="number" min="0" step="0.1" required value="${meal.carbs}" /></label>
      <label>Fat (g)<input name="fat" type="number" min="0" step="0.1" required value="${meal.fat}" /></label>
    </div>
    <div class="edit-actions">
      <button type="submit">Save</button>
      <button type="button" class="btn-secondary" data-action="cancel">Cancel</button>
    </div>
  `;

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(formEl);
    const name = String(data.get("name")).trim();
    if (!name) return;
    const updated = {
      ...meal,
      name,
      type: String(data.get("type")),
      date: String(data.get("date")),
      servings: Number(data.get("servings")) || 1,
      calories: Number(data.get("calories")) || 0,
      protein: Number(data.get("protein")) || 0,
      carbs: Number(data.get("carbs")) || 0,
      fat: Number(data.get("fat")) || 0,
    };
    const meals = loadMeals().map((m) => (m.id === meal.id ? updated : m));
    saveMeals(meals);
    editingId = null;
    filterDateInput.value = updated.date;
    render();
  });

  formEl.querySelector('[data-action="cancel"]').addEventListener("click", () => {
    editingId = null;
    render();
  });

  li.appendChild(formEl);
  return li;
}

function render() {
  const meals = loadMeals();
  const selectedDate = filterDateInput.value || todayISO();
  const dayMeals = meals
    .filter((m) => m.date === selectedDate)
    .sort((a, b) => a.createdAt - b.createdAt);

  listEl.innerHTML = "";
  for (const meal of dayMeals) {
    listEl.appendChild(meal.id === editingId ? buildEditRow(meal) : buildMealRow(meal));
  }
  emptyEl.classList.toggle("hidden", dayMeals.length > 0);

  const totals = nutritionForDate(meals, selectedDate);
  totalCalsEl.textContent = formatNumber(totals.calories, 0);
  totalProteinEl.textContent = formatNumber(totals.protein);
  totalCarbsEl.textContent = formatNumber(totals.carbs);
  totalFatEl.textContent = formatNumber(totals.fat);

  const goal = loadGoal();
  if (goal > 0) {
    const pct = Math.min(100, (totals.calories / goal) * 100);
    goalProgressEl.style.width = pct + "%";
    goalProgressEl.classList.toggle("over", totals.calories > goal);
    if (totals.calories > goal) {
      goalStatusEl.textContent = `Over by ${formatNumber(totals.calories - goal, 0)} kcal`;
    } else {
      goalStatusEl.textContent =
        `${formatNumber(totals.calories, 0)} / ${goal} kcal · ` +
        `${formatNumber(goal - totals.calories, 0)} remaining`;
    }
  } else {
    goalProgressEl.style.width = "0%";
    goalProgressEl.classList.remove("over");
    goalStatusEl.textContent = "Set a daily goal to see progress";
  }

  const dayStats = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(selectedDate, -i);
    dayStats.push({ date, ...nutritionForDate(meals, date) });
  }
  const sums = dayStats.reduce(
    (a, s) => ({
      calories: a.calories + s.calories,
      protein: a.protein + s.protein,
      carbs: a.carbs + s.carbs,
      fat: a.fat + s.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  avgCalsEl.textContent = formatNumber(sums.calories / 7, 0);
  avgProteinEl.textContent = formatNumber(sums.protein / 7);
  avgCarbsEl.textContent = formatNumber(sums.carbs / 7);
  avgFatEl.textContent = formatNumber(sums.fat / 7);

  const maxCals = Math.max(goal, ...dayStats.map((s) => s.calories), 1);
  chartEl.innerHTML = "";
  for (const s of dayStats) {
    const col = document.createElement("div");
    col.className = "bar-col" + (s.date === selectedDate ? " selected" : "");

    const valLabel = document.createElement("span");
    valLabel.className = "bar-val";
    valLabel.textContent = s.calories > 0 ? formatNumber(s.calories, 0) : "";

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = (s.calories / maxCals) * 100 + "%";
    if (goal > 0 && s.calories > goal) bar.classList.add("over");
    bar.title = `${s.date}: ${formatNumber(s.calories, 0)} kcal`;

    const day = document.createElement("span");
    day.className = "bar-day";
    day.textContent = weekdayLabel(s.date);

    col.appendChild(valLabel);
    col.appendChild(bar);
    col.appendChild(day);
    chartEl.appendChild(col);
  }
}

function deleteMeal(id) {
  const meals = loadMeals().filter((m) => m.id !== id);
  saveMeals(meals);
  if (editingId === id) editingId = null;
  render();
}

function csvEscape(s) {
  const str = String(s ?? "");
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function exportCSV() {
  const meals = loadMeals();
  const headers = ["id", "createdAt", "date", "type", "name", "servings", "calories", "protein", "carbs", "fat"];
  const lines = [headers.join(",")];
  for (const m of meals) lines.push(headers.map((h) => csvEscape(m[h])).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meals-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  dataStatusEl.textContent = `Exported ${meals.length} meal${meals.length === 1 ? "" : "s"}.`;
}

function parseCSVRow(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === ",") { out.push(cur); cur = ""; }
      else if (c === '"') inQuotes = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function importCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { added: 0, skipped: 0 };

  const header = parseCSVRow(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (h) => header.indexOf(h.toLowerCase());
  const required = ["date", "type", "name", "calories", "protein", "carbs", "fat"];
  for (const r of required) {
    if (idx(r) < 0) throw new Error(`Missing column: ${r}`);
  }

  const meals = loadMeals();
  const existingIds = new Set(meals.map((m) => m.id));
  let added = 0, skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const get = (h) => (idx(h) >= 0 ? cols[idx(h)] : "");

    const candidateId = get("id");
    if (candidateId && existingIds.has(candidateId)) { skipped++; continue; }

    const name = String(get("name")).trim();
    const date = String(get("date")).trim();
    if (!name || !date) { skipped++; continue; }

    const meal = {
      id: candidateId || createId(),
      createdAt: Number(get("createdAt")) || Date.now() + i,
      date,
      type: String(get("type")).trim() || "snack",
      name,
      servings: Number(get("servings")) || 1,
      calories: Number(get("calories")) || 0,
      protein: Number(get("protein")) || 0,
      carbs: Number(get("carbs")) || 0,
      fat: Number(get("fat")) || 0,
    };
    meals.push(meal);
    existingIds.add(meal.id);
    added++;
  }

  saveMeals(meals);
  return { added, skipped };
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const meal = {
    id: createId(),
    createdAt: Date.now(),
    name: String(data.get("name")).trim(),
    type: String(data.get("type")),
    date: String(data.get("date")),
    servings: Number(data.get("servings")) || 1,
    calories: Number(data.get("calories")) || 0,
    protein: Number(data.get("protein")) || 0,
    carbs: Number(data.get("carbs")) || 0,
    fat: Number(data.get("fat")) || 0,
  };
  if (!meal.name) return;

  const meals = loadMeals();
  meals.push(meal);
  saveMeals(meals);

  filterDateInput.value = meal.date;

  const keepType = form.elements.type.value;
  const keepDate = form.elements.date.value;
  form.reset();
  form.elements.type.value = keepType;
  form.elements.date.value = keepDate;
  form.elements.servings.value = "1";

  render();
});

filterDateInput.addEventListener("change", render);

goalInput.addEventListener("change", () => {
  saveGoal(Number(goalInput.value) || 0);
  render();
});

exportBtn.addEventListener("click", exportCSV);

importInput.addEventListener("change", async () => {
  const file = importInput.files && importInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const { added, skipped } = importCSV(text);
    dataStatusEl.textContent =
      `Imported ${added} meal${added === 1 ? "" : "s"}` +
      (skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.` : ".");
    render();
  } catch (err) {
    dataStatusEl.textContent = `Import failed: ${err.message}`;
  } finally {
    importInput.value = "";
  }
});

window.addMealFromEstimate = function (estimate) {
  const date = (form.elements.date && form.elements.date.value) || todayISO();
  const type = (form.elements.type && form.elements.type.value) || "snack";
  const meal = {
    id: createId(),
    createdAt: Date.now(),
    date,
    type,
    name: String(estimate.name || "Logged from assistant").trim(),
    servings: Number(estimate.servings) || 1,
    calories: Number(estimate.calories) || 0,
    protein: Number(estimate.protein) || 0,
    carbs: Number(estimate.carbs) || 0,
    fat: Number(estimate.fat) || 0,
  };
  const meals = loadMeals();
  meals.push(meal);
  saveMeals(meals);
  filterDateInput.value = date;
  render();
};

const today = todayISO();
form.elements.date.value = today;
filterDateInput.value = today;
const savedGoal = loadGoal();
if (savedGoal > 0) goalInput.value = savedGoal;
render();
