export type AutomationStep = {
  id: string;
  label: string;
  execute: () => Promise<unknown>;
};

export type AutomationStepResult = {
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt?: string;
  error?: string;
};

export type AutomationRunStatus = "running" | "paused" | "completed";

export type AutomationCheckpoint = {
  status: AutomationRunStatus;
  currentStep: string | null;
  stepResults: Record<string, AutomationStepResult>;
  pauseReason?: string;
  pausedAt?: string;
  completedAt?: string;
};

type RunOptions = {
  steps: AutomationStep[];
  checkpoint: AutomationCheckpoint;
  persist: (checkpoint: AutomationCheckpoint) => Promise<void>;
  now?: () => Date;
};

/**
 * Runs one event in strict sequence. A failed step pauses the event and
 * prevents every later step from running. Only successful steps are skipped
 * on resume; failed steps are retried only after an explicit resume request.
 */
export async function runSequentialAutomation(options: RunOptions): Promise<AutomationCheckpoint> {
  const now = options.now ?? (() => new Date());
  const checkpoint: AutomationCheckpoint = {
    ...options.checkpoint,
    status: "running",
    currentStep: options.checkpoint.currentStep ?? null,
    stepResults: { ...options.checkpoint.stepResults }
  };

  for (const step of options.steps) {
    if (checkpoint.stepResults[step.id]?.status === "success") continue;

    const startedAt = now().toISOString();
    checkpoint.currentStep = step.id;
    checkpoint.pauseReason = undefined;
    checkpoint.pausedAt = undefined;
    checkpoint.stepResults[step.id] = { status: "running", startedAt };
    await options.persist({ ...checkpoint, stepResults: { ...checkpoint.stepResults } });

    try {
      await step.execute();
      checkpoint.stepResults[step.id] = {
        status: "success",
        startedAt,
        finishedAt: now().toISOString()
      };
      await options.persist({ ...checkpoint, stepResults: { ...checkpoint.stepResults } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checkpoint.stepResults[step.id] = {
        status: "failed",
        startedAt,
        finishedAt: now().toISOString(),
        error: message
      };
      checkpoint.status = "paused";
      checkpoint.pauseReason = `Etapa "${step.label}" falhou: ${message}`;
      checkpoint.pausedAt = now().toISOString();
      await options.persist({ ...checkpoint, stepResults: { ...checkpoint.stepResults } });
      return checkpoint;
    }
  }

  checkpoint.status = "completed";
  checkpoint.currentStep = null;
  checkpoint.pauseReason = undefined;
  checkpoint.completedAt = now().toISOString();
  await options.persist({ ...checkpoint, stepResults: { ...checkpoint.stepResults } });
  return checkpoint;
}
