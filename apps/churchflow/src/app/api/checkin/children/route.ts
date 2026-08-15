import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getTenantFromRequest } from "@/lib/tenant";
import {
  requestBranchContext,
  applyBranchFilter,
  branchIdForWrite,
} from "@/lib/branch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const tenantId = await getTenantFromRequest(request);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const classId = searchParams.get("class_id") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const branchCtx = await requestBranchContext(request, tenantId);

    let query = supabase
      .from("cf_checkin_children")
      .select("*, cf_checkin_classes!inner(name)", { count: "exact" })
      .eq("tenant_id", tenantId);

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,guardian_name.ilike.%${search}%`);
    }

    if (classId) {
      query = query.eq("class_id", classId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    query = applyBranchFilter(query, branchCtx);

    const { data: children, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      children,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Checkin children GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenantId = await getTenantFromRequest(request);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      first_name,
      last_name,
      date_of_birth,
      gender,
      class_id,
      guardian_name,
      guardian_phone,
      guardian_email,
      emergency_contact,
      emergency_phone,
      medical_notes,
      allergies,
      pickup_authorized,
    } = body;

    if (!first_name || !last_name || !guardian_name || !guardian_phone) {
      return NextResponse.json(
        { error: "First name, last name, guardian name, and guardian phone are required" },
        { status: 400 }
      );
    }

    const qr_code = `CHF-${tenantId.slice(0, 8)}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

    const branchCtx = await requestBranchContext(request, tenantId);

    const { data: child, error } = await supabase
      .from("cf_checkin_children")
      .insert({
        tenant_id: tenantId,
        branch_id: branchIdForWrite(branchCtx, body.branch_id),
        first_name,
        last_name,
        date_of_birth,
        gender,
        class_id,
        guardian_name,
        guardian_phone,
        guardian_email,
        emergency_contact,
        emergency_phone,
        medical_notes,
        allergies,
        pickup_authorized: pickup_authorized || [guardian_name],
        qr_code,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ child }, { status: 201 });
  } catch (error) {
    console.error("Checkin children POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
