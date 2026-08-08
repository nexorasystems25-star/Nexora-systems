-- ============================================================================
-- CHURCHFLOW DEMO TENANT SEED DATA
-- ============================================================================
-- Run this after the multi-tenant migration to populate a demo tenant.
-- Default tenant: GRAG Church (slug: grag)
-- ============================================================================

-- 1. Create demo organization (tenant)
INSERT INTO public.organizations (id, name, slug, product_id, lifecycle_state, contact_email, contact_phone, address)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'GRAG Church',
  'grag',
  (SELECT id FROM public.products WHERE slug = 'churchflow' LIMIT 1),
  'active',
  'admin@gragchurch.org',
  '+233 24 000 1234',
  'Ahodwo, Kumasi, Ghana'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Create demo subscription
INSERT INTO public.subscriptions (id, organization_id, product_id, plan, status, current_period_start, current_period_end)
VALUES (
  gen_random_uuid(),
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM public.products WHERE slug = 'churchflow' LIMIT 1),
  'professional',
  'active',
  NOW(),
  NOW() + INTERVAL '30 days'
) ON CONFLICT DO NOTHING;

-- 3. Create demo identity (admin user)
INSERT INTO public.identities (id, email, full_name, email_verified)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'admin@gragchurch.org',
  'Pastor Daniel Asante',
  true
) ON CONFLICT (email) DO NOTHING;

-- 4. Create membership (admin → tenant)
INSERT INTO public.memberships (id, identity_id, organization_id, role, status)
VALUES (
  gen_random_uuid(),
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'owner',
  'active'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- CHURCHFLOW MODULE DATA (tenant_id = GRAG)
-- ============================================================================

-- 5. Members
INSERT INTO public.cf_members (tenant_id, church_id, name, initials, group_name, phone, email, gender, birth_date, marital_status, status, joined_at)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CH-001', 'Akosua Mensah', 'AM', 'Women''s Fellowship', '024 123 4567', 'akosua@example.com', 'Female', '1990-03-15', 'Married', 'Active', '2024-01-15'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CH-002', 'Kwame Owusu', 'KO', 'Ushers', '055 234 5678', 'kwame@example.com', 'Male', '1985-07-22', 'Married', 'Active', '2024-02-01'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CH-003', 'Abena Boateng', 'AB', 'Choir', '020 345 6789', 'abena@example.com', 'Female', '1995-11-08', 'Single', 'Active', '2024-03-10'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CH-004', 'Kofi Asare', 'KA', 'Youth Ministry', '027 456 7890', 'kofi@example.com', 'Male', '1998-01-30', 'Single', 'Active', '2024-04-05'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CH-005', 'Yaa Serwaa', 'YS', 'Women''s Fellowship', '050 567 8901', 'yaa@example.com', 'Female', '1988-06-12', 'Married', 'Active', '2024-05-20'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CH-006', 'Emmanuel Frimpong', 'EF', 'Worship Team', '024 678 9012', 'emmanuel@example.com', 'Male', '1992-09-25', 'Single', 'Active', '2024-06-01'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CH-007', 'Nana Boakye', 'NB', 'Media Team', '055 789 0123', 'nana@example.com', 'Male', '1997-04-18', 'Single', 'Active', '2024-07-15'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CH-008', 'Priscilla Agyeman', 'PA', 'Youth Ministry', '020 890 1234', 'priscilla@example.com', 'Female', '1993-12-03', 'Single', 'Active', '2024-08-01');

-- 6. Organisation Units
INSERT INTO public.cf_organisation_units (tenant_id, name, type, leader_name, member_count, meeting_schedule, campus)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Youth Ministry', 'Ministry', 'Priscilla Agyeman', 86, 'Saturdays · 4:00 PM', 'Grace Centre'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Women''s Ministry', 'Fellowship', 'Deaconess Lydia Owusu', 124, 'Tuesdays · 5:30 PM', 'Grace Centre'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Finance Department', 'Department', 'Daniel Asante', 8, 'First Monday monthly', 'Grace Centre'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Choir', 'Ministry', 'Emmanuel Frimpong', 34, 'Thursdays · 6:00 PM', 'Grace Centre');

-- 7. Attendance Sessions
INSERT INTO public.cf_attendance_sessions (tenant_id, session_code, title, service_type, service_date, start_time, campus, venue, status, expected_count)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ATT-260802-01', 'Sunday Celebration Service', 'Sunday Service', '2026-08-02', '08:30', 'Grace Centre', 'Main Auditorium', 'Open', 420),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ATT-260729-01', 'Midweek Bible Teaching', 'Midweek Service', '2026-07-29', '18:00', 'Grace Centre', 'Chapel', 'Completed', 180),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ATT-260726-01', 'Sunday Celebration Service', 'Sunday Service', '2026-07-26', '08:30', 'Grace Centre', 'Main Auditorium', 'Completed', 400);

-- 8. Church Events
INSERT INTO public.cf_church_events (tenant_id, event_code, title, event_type, start_date, start_time, end_time, coordinator, expected_attendance, status)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'EVT-260802-01', 'Sunday Celebration Service', 'Service', '2026-08-02', '08:30', '11:00', 'Pastor Daniel Asante', 420, 'Ready'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'EVT-260805-02', 'Midweek Bible Teaching', 'Service', '2026-08-05', '18:00', '19:30', 'Rev. Lydia Owusu', 180, 'Planning'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'EVT-260809-03', 'Youth Empowerment Summit', 'Conference', '2026-08-09', '10:00', '16:00', 'Priscilla Agyeman', 260, 'Planning');

-- 9. Finance Funds
INSERT INTO public.cf_finance_funds (tenant_id, name, code, purpose, status)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'General Fund', 'GF', 'Church operations', 'Active'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Missions Fund', 'MF', 'Global missions', 'Active'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Building Fund', 'BF', 'Church building project', 'Active');

-- 10. Finance Transactions
INSERT INTO public.cf_finance_transactions (tenant_id, reference, type, category, fund_id, amount_pesewas, transaction_date, payment_method, description, payer_payee, status, recorded_by)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CF-INC-001', 'Income', 'Tithe', (SELECT id FROM public.cf_finance_funds WHERE code = 'GF' AND tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'), 150000, '2026-08-02', 'Mobile Money', 'Weekly tithe collection', 'Congregation', 'Approved', 'Pastor Daniel Asante'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CF-INC-002', 'Income', 'Offering', (SELECT id FROM public.cf_finance_funds WHERE code = 'GF' AND tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'), 85000, '2026-08-02', 'Cash', 'Sunday offering', 'Congregation', 'Approved', 'Pastor Daniel Asante'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CF-EXP-001', 'Expense', 'Utilities', (SELECT id FROM public.cf_finance_funds WHERE code = 'GF' AND tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'), 45000, '2026-08-01', 'Bank Transfer', 'Electricity bill - July', 'ECG Ghana', 'Approved', 'Daniel Asante'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CF-EXP-002', 'Expense', 'Staff Salary', (SELECT id FROM public.cf_finance_funds WHERE code = 'GF' AND tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'), 320000, '2026-08-01', 'Bank Transfer', 'August payroll', 'Church staff', 'Pending', 'Daniel Asante');

-- 11. Care Cases
INSERT INTO public.cf_care_cases (tenant_id, case_code, person_name, person_phone, person_type, case_type, source, priority, stage, assigned_to, next_action_date, summary, status, created_by)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CARE-2607-001', 'Abena Boateng', '020 771 1904', 'New Convert', 'New Convert Follow-up', 'Sunday altar call', 'High', 'First Contact', 'Rev. Lydia Owusu', '2026-07-31', 'Welcome call and foundation class introduction required.', 'Open', 'Pastor Daniel Asante'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CARE-2607-002', 'Kofi Asare', '027 120 3301', 'Member', 'Pastoral Follow-up', 'Church office', 'Normal', 'Visit Scheduled', 'Pastor Daniel Asante', '2026-08-01', 'Home visit requested after extended absence.', 'Open', 'Pastor Daniel Asante');

-- 12. Volunteers
INSERT INTO public.cf_volunteers (tenant_id, volunteer_code, name, phone, skills, availability, ministry_preference, safeguarding_status, status, created_by_user_id, created_by_name)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'VOL-001', 'Kwame Owusu', '055 234 5678', 'Hospitality, Guest care', 'Sundays', 'Ushers', 'Verified', 'Active', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Pastor Daniel Asante'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'VOL-002', 'Emmanuel Frimpong', '024 678 9012', 'Music, Worship', 'Sundays and midweek', 'Worship Team', 'Verified', 'Active', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Pastor Daniel Asante');

-- 13. Communication Campaigns
INSERT INTO public.cf_communication_campaigns (tenant_id, campaign_code, name, channel, audience, subject, message, status, recipient_count, created_by_user_id, created_by_name, created_by_email)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CMP-001', 'Sunday Service Reminder', 'SMS', 'Active Members', 'Service Reminder', 'Reminder: Sunday Service starts at 8:30 AM. See you there!', 'Sent', 8, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Pastor Daniel Asante', 'admin@gragchurch.org');

-- 14. Payroll Staff
INSERT INTO public.cf_payroll_staff (tenant_id, staff_code, full_name, job_title, department, employment_type, base_salary_pesewas, recurring_allowance_pesewas, recurring_deduction_pesewas, status, created_by_user_id, created_by_name)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'STF-001', 'Akosua Mensah', 'Church Administrator', 'Administration', 'Full-time', 320000, 35000, 18000, 'Active', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Pastor Daniel Asante'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'STF-002', 'Kwame Owusu', 'Facilities Coordinator', 'Operations', 'Part-time', 180000, 15000, 5000, 'Active', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Pastor Daniel Asante');

-- ============================================================================
-- DONE
-- ============================================================================
-- Demo tenant 'GRAG Church' is ready.
-- Login: admin@gragchurch.org
-- Tenant ID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- ============================================================================
