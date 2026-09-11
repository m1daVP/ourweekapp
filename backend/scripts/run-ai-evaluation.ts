import { appendFile, mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { env } from '../src/config/env.js';
import { buildSafetyIdentifier } from '../src/modules/ai/safety-identifier.js';
import { evaluateAiSummaryCase } from '../src/modules/ai/evaluation.js';
import { aiEvaluationCases } from '../src/modules/ai/evaluation-fixtures.js';
import { buildSummaryPromptPayload } from '../src/modules/ai/summary-payload.js';
import { OpenAiSummaryProvider, isAiSummaryProviderError } from '../src/modules/ai/openai.client.js';

function outputPathFromArguments(args: string[]) {
  const outputFlagIndex = args.indexOf('--output');
  const outputPath = outputFlagIndex >= 0 ? args[outputFlagIndex + 1] : undefined;

  if (!outputPath || !isAbsolute(outputPath)) {
    throw new Error('Pass an absolute --output path outside this repository.');
  }

  const resolvedOutput = resolve(outputPath);
  const relativeToRepository = relative(process.cwd(), resolvedOutput);
  if (!relativeToRepository.startsWith('..') && !isAbsolute(relativeToRepository)) {
    throw new Error('Evaluation evidence must be written outside this repository.');
  }

  return resolvedOutput;
}

async function assertOutputDoesNotExist(outputPath: string) {
  try {
    await stat(outputPath);
    throw new Error('Refusing to overwrite existing evaluation evidence. Choose a new output path.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function main() {
  if (process.env.AI_EVALUATION_LIVE !== 'true') {
    throw new Error('Set AI_EVALUATION_LIVE=true before running a funded provider evaluation.');
  }

  if (env.AI_PROVIDER !== 'openai' || !env.AI_CONFIGURED) {
    throw new Error('AI_PROVIDER=openai with complete server configuration is required.');
  }

  const outputPath = outputPathFromArguments(process.argv.slice(2));
  await assertOutputDoesNotExist(outputPath);
  await mkdir(dirname(outputPath), { recursive: true });

  const provider = new OpenAiSummaryProvider(env.AI_API_KEY);
  const safetyIdentifier = buildSafetyIdentifier(
    'synthetic-ai-evaluation-user-v1',
    env.AI_SAFETY_IDENTIFIER_SECRET,
  );
  let failed = false;
  const includeSyntheticReview = process.argv.includes('--include-synthetic-review');

  const args = process.argv.slice(2);
  const caseIndex = args.indexOf('--case');
  const caseId = caseIndex >= 0 ? args[caseIndex + 1] : undefined;
  if (caseIndex >= 0 && (!caseId || !aiEvaluationCases.some((item) => item.id === caseId))) {
    throw new Error('Pass --case with an exact synthetic corpus case id.');
  }
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : aiEvaluationCases.length;
  if (!Number.isInteger(limit) || limit < 1 || limit > aiEvaluationCases.length) {
    throw new Error(`Pass --limit as an integer from 1 to ${aiEvaluationCases.length}.`);
  }
  const selectedCases = aiEvaluationCases.filter((item) => !caseId || item.id === caseId).slice(0, limit);
  for (const evaluationCase of selectedCases) {
    let generatedOutput: unknown;
    try {
      const evidence = await evaluateAiSummaryCase(evaluationCase, {
        async generateMeetingSummary(request) {
          const result = await provider.generateMeetingSummary(request);
          generatedOutput = result.output;
          return result;
        },
      }, safetyIdentifier);
      const row = includeSyntheticReview ? {
        ...evidence,
        syntheticHumanReview: {
          input: JSON.parse(buildSummaryPromptPayload(evaluationCase.meeting, evaluationCase.participants, evaluationCase.locale)),
          output: generatedOutput,
          focus: evaluationCase.humanReviewFocus,
          scores: null,
        },
      } : evidence;
      await appendFile(outputPath, `${JSON.stringify(row)}\n`, 'utf8');
      failed = failed || evidence.status === 'failed';
    } catch (error) {
      if (!isAiSummaryProviderError(error)) throw error;
      failed = true;
      await appendFile(outputPath, `${JSON.stringify({
        caseId: evaluationCase.id, locale: evaluationCase.locale,
        templateId: evaluationCase.meeting.templateId, status: 'failed',
        issueCodes: [error.metadata.failureClass], providerFailure: error.metadata,
      })}\n`, 'utf8');
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${isAiSummaryProviderError(error)
    ? JSON.stringify(error.metadata)
    : error instanceof Error ? error.message : 'AI evaluation failed.'}\n`);
  process.exitCode = 1;
});
