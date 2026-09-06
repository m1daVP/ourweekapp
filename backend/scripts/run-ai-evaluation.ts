import { appendFile, mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { env } from '../src/config/env.js';
import { buildSafetyIdentifier } from '../src/modules/ai/safety-identifier.js';
import { evaluateAiSummaryCase } from '../src/modules/ai/evaluation.js';
import { aiEvaluationCases } from '../src/modules/ai/evaluation-fixtures.js';
import { OpenAiSummaryProvider } from '../src/modules/ai/openai.client.js';

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

  for (const evaluationCase of aiEvaluationCases) {
    const evidence = await evaluateAiSummaryCase(evaluationCase, provider, safetyIdentifier);
    await appendFile(outputPath, `${JSON.stringify(evidence)}\n`, 'utf8');
    failed = failed || evidence.status === 'failed';
  }

  if (failed) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'AI evaluation failed.'}\n`);
  process.exitCode = 1;
});
