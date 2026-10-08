"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { EvidenceRepository } from "@/services/evidenceRepository";
import { LocalEvidenceRepository } from "@/services/localEvidenceRepository";

const RepositoryContext = createContext<EvidenceRepository | null>(null);

/**
 * Supplies the repository to the UI. The prototype uses the local implementation;
 * production would pass an API client implementing the same interface.
 */
export function RepositoryProvider({ children, repository }: { children: ReactNode; repository?: EvidenceRepository }) {
  const [repo] = useState<EvidenceRepository>(() => repository ?? new LocalEvidenceRepository({ persist: true }));
  useEffect(() => {
    repo.hydrate();
  }, [repo]);
  return <RepositoryContext.Provider value={repo}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): EvidenceRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error("useRepository must be used inside <RepositoryProvider>");
  return repo;
}

/** Loads data from the repository and reloads whenever it changes. `key` identifies the query. */
export function useRepoQuery<T>(load: (repo: EvidenceRepository) => Promise<T>, key: string) {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error("useRepoQuery must be used inside <RepositoryProvider>");
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const [data, setData] = useState<T | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => repo.subscribe(() => setVersion((v) => v + 1)), [repo]);
  useEffect(() => {
    let alive = true;
    loadRef.current(repo).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [repo, key, version]);

  return { data, loading: data === null };
}
