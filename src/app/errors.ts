export function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const status = "status" in error ? error.status : null;
    const code = "code" in error ? error.code : null;
    // PostgrestError can expose a code without the original HTTP status.
    if (
      status === 401 ||
      status === 403 ||
      ["PGRST301", "PGRST303", "42501"].includes(String(code))
    ) {
      return "Сессия истекла или доступ ограничен. Выйдите и войдите снова.";
    }
  }
  return "Не удалось загрузить данные. Проверьте соединение и попробуйте ещё раз.";
}
