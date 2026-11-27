// Убирает base64-изображения из объекта, сохраняя структуру.
// Используется архивом и бэкапом, чтобы не раздувать localStorage.

export function stripBase64Images(value, state = { changed: false }) {
  if (Array.isArray(value)) {
    return value.map(item => stripBase64Images(item, state));
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (
        key === 'image' &&
        typeof item === 'string' &&
        item.startsWith('data:')
      ) {
        result[key] = '';
        state.changed = true;
      } else {
        result[key] = stripBase64Images(item, state);
      }
    }
    return result;
  }

  return value;
}
