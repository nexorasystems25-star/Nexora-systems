-- ============================================================================
-- COMBINED SETUP: Migration + Seed Data
-- ============================================================================
-- Run this ONE file in Supabase SQL Editor to set up everything.
-- ============================================================================

-- Step 1: Run the full migration
\ir migrations/20250805_multi_tenant_platform.sql

-- Step 2: Add ChurchFlow module seed data
-- (tenant_id = GRAG org ID, looked up dynamically)

DO $$
DECLARE
    grag_id UUID;
    grag_user_id UUID;
    fund_gf_id BIGINT;
    fund_mf_id BIGINT;
    fund_bf_id BIGINT;
BEGIN
    -- Get GRAG org ID
    SELECT id INTO grag_id FROM public.organizations WHERE slug = 'grag';
    IF grag_id IS NULL THEN
        RAISE NOTICE 'GRAG org not found, skipping seed data';
        RETURN;
    END IF;

    -- Create demo identity for admin
    INSERT INTO public.identities (id, email, full_name, email_verified)
    VALUES (
        'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        'admin@gragchurch.org',
        'Pastor Daniel Asante',
        true
    ) ON CONFLICT (email) DO NOTHING
    RETURNING id INTO grag_user_id;

    -- Create membership
    INSERT INTO public.memberships (identity_id, organization_id, role, scope, status)
    VALUES (
        COALESCE(grag_user_id, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
        grag_id,
        'owner',
        'tenant',
        'active'
    ) ON CONFLICT DO NOTHING;

    -- Members
    INSERT INTO public.cf_members (tenant_id, church_id, name, initials, group_name, phone, email, gender, birth_date, marital_status, status, joined_at)
    VALUES
      (grag_id, 'CH-001', 'Akosua Mensah', 'AM', 'Women''s Fellowship', '024 123 4567', 'akosua@example.com', 'Female', '1990-03-15', 'Married', 'Active', '2024-01-15'),
      (grag_id, 'CH-002', 'Kwame Owusu', 'KO', 'Ushers', '055 234 5678', 'kwame@example.com', 'Male', '1985-07-22', 'Married', 'Active', '2024-02-01'),
      (grag_id, 'CH-003', 'Abena Boateng', 'AB', 'Choir', '020 345 6789', 'abena@example.com', 'Female', '1995-11-08', 'Single', 'Active', '2024-03-10'),
      (grag_id, 'CH-004', 'Kofi Asare', 'KA', 'Youth Ministry', '027 456 7890', 'kofi@example.com', 'Male', '1998-01-30', 'Single', 'Active', '2024-04-05'),
      (grag_id, 'CH-005', 'Yaa Serwaa', 'YS', 'Women''s Fellowship', '050 567 8901', 'yaa@example.com', 'Female', '1988-06-12', 'Married', 'Active', '2024-05-20'),
      (grag_id, 'CH-006', 'Emmanuel Frimpong', 'EF', 'Worship Team', '024 678 9012', 'emmanuel@example.com', 'Male', '1992-09-25', 'Single', 'Active', '2024-06-01'),
      (grag_id, 'CH-007', 'Nana Boakye', 'NB', 'Media Team', '055 789 0123', 'nana@example.com', 'Male', '1997-04-18', 'Single', 'Active', '2024-07-15'),
      (grag_id, 'CH-008', 'Priscilla Agyeman', 'PA', 'Youth Ministry', '020 890 1234', 'priscilla@example.com', 'Female', '1993-12-03', 'Single', 'Active', '2024-08-01')
    ON CONFLICT (tenant_id, church_id) DO NOTHING;

    -- Organisation Units
    INSERT INTO public.cf_organisation_units (tenant_id, name, type, leader_name, member_count, meeting_schedule, campus)
    VALUES
      (grag_id, 'Youth Ministry', 'Ministry', 'Priscilla Agyeman', 86, 'Saturdays 4:00 PM', 'Grace Centre'),
      (grag_id, 'Women''s Ministry', 'Fellowship', 'Deaconess Lydia Owusu', 124, 'Tuesdays 5:30 PM', 'Grace Centre'),
      (grag_id, 'Finance Department', 'Department', 'Daniel Asante', 8, 'First Monday monthly', 'Grace Centre'),
      (grag_id, 'Choir', 'Ministry', 'Emmanuel Frimpong', 34, 'Thursdays 6:00 PM', 'Grace Centre')
    ON CONFLICT (tenant_id, name) DO NOTHING;

    -- Finance Funds
    INSERT INTO public.cf_finance_funds (tenant_id, name, code, purpose, status)
    VALUES
      (grag_id, 'General Fund', 'GF', 'Church operations', 'Active'),
      (grag_id, 'Missions Fund', 'MF', 'Global missions', 'Active'),
      (grag_id, 'Building Fund', 'BF', 'Church building project', 'Active')
    ON CONFLICT (tenant_id, code) DO NOTHING
    RETURNING id, code;

    -- Get fund IDs for transactions
    SELECT id INTO fund_gf_id FROM public.cf_finance_funds WHERE code = 'GF' AND tenant_id = grag_id;
    SELECT id INTO fund_mf_id FROM public.cf_finance_funds WHERE code = 'MF' AND tenant_id = grag_id;
    SELECT id INTO fund_bf_id FROM public.cf_finance_funds WHERE code = 'BF' AND tenant_id = grag_id;

    -- Finance Transactions
    IF fund_gf_id IS NOT NULL THEN
        INSERT INTO public.cf_finance_transactions (tenant_id, reference, type, category, fund_id, amount_pesewas, transaction_date, payment_method, description, payer_payee, status, recorded_by)
        VALUES
          (grag_id, 'CF-INC-001', 'Income', 'Tithe', fund_gf_id, 150000, '2026-08-02', 'Mobile Money', 'Weekly tithe collection', 'Congregation', 'Approved', 'Pastor Daniel Asante'),
          (grag_id, 'CF-INC-002', 'Income', 'Offering', fund_gf_id, 85000, '2026-08-02', 'Cash', 'Sunday offering', 'Congregation', 'Approved', 'Pastor Daniel Asante'),
          (grag_id, 'CF-EXP-001', 'Expense', 'Utilities', fund_gf_id, 45000, '2026-08-01', 'Bank Transfer', 'Electricity bill - July', 'ECG Ghana', 'Approved', 'Daniel Asante'),
          (grag_id, 'CF-EXP-002', 'Expense', 'Staff Salary', fund_gf_id, 320000, '2026-08-01', 'Bank Transfer', 'August payroll', 'Church staff', 'Pending', 'Daniel Asante')
        ON CONFLICT (tenant_id, reference) DO NOTHING;
    END IF;

    -- Attendance Sessions
    INSERT INTO public.cf_attendance_sessions (tenant_id, session_code, title, service_type, service_date, start_time, campus, venue, status, expected_count)
    VALUES
      (grag_id, 'ATT-260802-01', 'Sunday Celebration Service', 'Sunday Service', '2026-08-02', '08:30', 'Grace Centre', 'Main Auditorium', 'Open', 420),
      (grag_id, 'ATT-260729-01', 'Midweek Bible Teaching', 'Midweek Service', '2026-07-29', '18:00', 'Grace Centre', 'Chapel', 'Completed', 180),
      (grag_id, 'ATT-260726-01', 'Sunday Celebration Service', 'Sunday Service', '2026-07-26', '08:30', 'Grace Centre', 'Main Auditorium', 'Completed', 400)
    ON CONFLICT (tenant_id, session_code) DO NOTHING;

    -- Church Events
    INSERT INTO public.cf_church_events (tenant_id, event_code, title, event_type, start_date, start_time, end_time, coordinator, expected_attendance, status)
    VALUES
      (grag_id, 'EVT-260802-01', 'Sunday Celebration Service', 'Service', '2026-08-02', '08:30', '11:00', 'Pastor Daniel Asante', 420, 'Ready'),
      (grag_id, 'EVT-260805-02', 'Midweek Bible Teaching', 'Service', '2026-08-05', '18:00', '19:30', 'Rev. Lydia Owusu', 180, 'Planning'),
      (grag_id, 'EVT-260809-03', 'Youth Empowerment Summit', 'Conference', '2026-08-09', '10:00', '16:00', 'Priscilla Agyeman', 260, 'Planning')
    ON CONFLICT (tenant_id, event_code) DO NOTHING;

    -- Care Cases
    INSERT INTO public.cf_care_cases (tenant_id, case_code, person_name, person_phone, person_type, case_type, source, priority, stage, assigned_to, next_action_date, summary, status, created_by)
    VALUES
      (grag_id, 'CARE-2607-001', 'Abena Boateng', '020 771 1904', 'New Convert', 'New Convert Follow-up', 'Sunday altar call', 'High', 'First Contact', 'Rev. Lydia Owusu', '2026-07-31', 'Welcome call and foundation class introduction required.', 'Open', 'Pastor Daniel Asante'),
      (grag_id, 'CARE-2607-002', 'Kofi Asare', '027 120 3301', 'Member', 'Pastoral Follow-up', 'Church office', 'Normal', 'Visit Scheduled', 'Pastor Daniel Asante', '2026-08-01', 'Home visit requested after extended absence.', 'Open', 'Pastor Daniel Asante')
    ON CONFLICT (tenant_id, case_code) DO NOTHING;

    -- Volunteers
    INSERT INTO public.cf_volunteers (tenant_id, volunteer_code, name, phone, skills, availability, ministry_preference, safeguarding_status, status, created_by_user_id, created_by_name)
    VALUES
      (grag_id, 'VOL-001', 'Kwame Owusu', '055 234 5678', 'Hospitality, Guest care', 'Sundays', 'Ushers', 'Verified', 'Active', NULL, 'Pastor Daniel Asante'),
      (grag_id, 'VOL-002', 'Emmanuel Frimpong', '024 678 9012', 'Music, Worship', 'Sundays and midweek', 'Worship Team', 'Verified', 'Active', NULL, 'Pastor Daniel Asante')
    ON CONFLICT (tenant_id, volunteer_code) DO NOTHING;

    -- Communication Campaigns
    INSERT INTO public.cf_communication_campaigns (tenant_id, campaign_code, name, channel, audience, subject, message, status, recipient_count, created_by_user_id, created_by_name, created_by_email)
    VALUES
      (grag_id, 'CMP-001', 'Sunday Service Reminder', 'SMS', 'Active Members', 'Service Reminder', 'Reminder: Sunday Service starts at 8:30 AM. See you there!', 'Sent', 8, NULL, 'Pastor Daniel Asante', 'admin@gragchurch.org')
    ON CONFLICT (tenant_id, campaign_code) DO NOTHING;

    -- Payroll Staff
    INSERT INTO public.cf_payroll_staff (tenant_id, staff_code, full_name, job_title, department, employment_type, base_salary_pesewas, recurring_allowance_pesewas, recurring_deduction_pesewas, status, created_by_user_id, created_by_name)
    VALUES
      (grag_id, 'STF-001', 'Akosua Mensah', 'Church Administrator', 'Administration', 'Full-time', 320000, 35000, 18000, 'Active', NULL, 'Pastor Daniel Asante'),
      (grag_id, 'STF-002', 'Kwame Owusu', 'Facilities Coordinator', 'Operations', 'Part-time', 180000, 15000, 5000, 'Active', NULL, 'Pastor Daniel Asante')
    ON CONFLICT (tenant_id, staff_code) DO NOTHING;

    RAISE NOTICE 'Seed data inserted for GRAG tenant';
END $$;
