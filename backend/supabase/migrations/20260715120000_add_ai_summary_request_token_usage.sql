alter table public.ai_summary_requests
  add column input_tokens integer,
  add column output_tokens integer,
  add column total_tokens integer;

alter table public.ai_summary_requests
  add constraint ai_summary_requests_input_tokens_non_negative check (input_tokens is null or input_tokens >= 0),
  add constraint ai_summary_requests_output_tokens_non_negative check (output_tokens is null or output_tokens >= 0),
  add constraint ai_summary_requests_total_tokens_non_negative check (total_tokens is null or total_tokens >= 0);
