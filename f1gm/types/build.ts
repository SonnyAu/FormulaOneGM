export type BuildInfo = {
  buildId: string;
  version: string;
  commitSha: string | null;
  commitShort: string | null;
  label: string;
  updateLog: {
    title: string;
    changes: string[];
  };
};
