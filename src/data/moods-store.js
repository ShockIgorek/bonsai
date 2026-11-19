export const defaultMoods = [
  { 
    id: 'default', 
    name: 'Норма', 
    theme: 'bonsai', 
    icon: '😐',
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
