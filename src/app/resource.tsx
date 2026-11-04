import { useEffect, useState } from "react";
import { errorMessage } from "./errors.ts";

export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T };
export function useResource<T>(key: string, load: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [value, setValue] = useState<{
    key: string;
    revision: number;
    state: Resource<T>;
  }>();
  useEffect(() => {
    let active = true;
    setValue({ key, revision, state: { status: "loading" } });
    Promise.resolve()
      .then(load)
      .then(
        (data) => {
          if (active)
            setValue({ key, revision, state: { status: "ready", data } });
        },
        (error) => {
          if (active)
            setValue({ key, revision, state: { status: "error", error } });
        },
      );
    return () => {
      active = false;
    };
  }, [key, revision, load]);
  // Hide a previous result synchronously, before the next effect can run.
  const state: Resource<T> =
    value?.key === key && value.revision === revision
      ? value.state
      : { status: "loading" };
  return { state, retry: () => setRevision((n) => n + 1) };
}

export function ResourceState({
  state,
  retry,
}: {
  state: Resource<unknown>;
  retry: () => void;
}) {
  if (state.status === "loading")
    return (
      <div className="state-box" role="status">
        <span className="loader" />
        Загружаем данные…
      </div>
    );
  if (state.status === "error")
    return (
      <div className="state-box error-box" role="alert">
        <p>{errorMessage(state.error)}</p>
        <button className="button secondary" onClick={retry}>
          Попробовать снова
        </button>
      </div>
    );
  return null;
}
