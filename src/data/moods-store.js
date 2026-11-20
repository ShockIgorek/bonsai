export const defaultMoods = [
  {
    id: 'default',
    name: 'Норма',
    description: '',
    theme: 'bonsai',
    image: '',
    hiddenTasks: []
  }
];

export function getMoods() {
  const saved = localStorage.getItem('bonsai-moods');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return defaultMoods;
    }
  }
  return defaultMoods;
}

export function saveMoods(moods) {
  localStorage.setItem('bonsai-moods', JSON.stringify(moods));
}

export function updateMoodTheme(moodId, themeId) {
  const moods = getMoods();
  const mood = moods.find(m => m.id === moodId);
  if (mood) {
    mood.theme = themeId;
    saveMoods(moods);
  }
}

export function updateMood(moodId, patch) {
  const moods = getMoods();
  const idx = moods.findIndex(m => m.id === moodId);
  if (idx === -1) return null;
  moods[idx] = { ...moods[idx], ...patch };
  saveMoods(moods);
  return moods[idx];
}

export function addMood(mood) {
  const moods = getMoods();
  const newMood = {
    id: `mood_${Date.now()}`,
    name: mood.name || 'Новое',
    description: mood.description || '',
    theme: mood.theme || 'bonsai',
    image: mood.image || '',
    hiddenTasks: []
  };
  moods.push(newMood);
  saveMoods(moods);
  return newMood;
}
