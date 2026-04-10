import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/prisma";

const BCRYPT_ROUNDS = 12;
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL?.trim() || "demo@demo.com";
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD?.trim() || "demo123456";
const PAGE_SIZE = 100;

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findSupabaseUserByEmail(
  supabase: any,
  email: string
) {
  let page = 1;
  while (true) {
    const result = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (result.error) {
      throw new Error(`Supabase listUsers failed: ${result.error.message}`);
    }

    const users = (result.data?.users ?? []) as Array<{ email?: string; id?: string }>;
    const existing = users.find((user) => user.email?.toLowerCase() === email);
    if (existing) {
      return existing;
    }

    if (users.length < PAGE_SIZE) {
      return null;
    }

    page += 1;
  }
}

async function ensureSupabaseDemoUser(
  supabase: any,
  email: string,
  password: string
) {
  const existing = await findSupabaseUserByEmail(supabase, email);
  if (existing) {
    console.log(`Supabase auth user already exists: ${existing.id}`);
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Supabase createUser failed: ${error.message}`);
  }

  const createdUser = data?.user;
  if (!createdUser?.id) {
    throw new Error("Supabase createUser returned no user ID.");
  }

  console.log(`Created Supabase auth user: ${createdUser.id}`);
  return createdUser;
}

async function main() {
  const supabaseUrl = requiredEnv("SUPABASE_URL", SUPABASE_URL);
  const supabaseKey = requiredEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_SERVICE_ROLE_KEY
  );

  const email = normalizeEmail(DEMO_USER_EMAIL);
  const password = DEMO_USER_PASSWORD;

  if (!email) {
    throw new Error("DEMO_USER_EMAIL is empty after trimming.");
  }
  if (!password) {
    throw new Error("DEMO_USER_PASSWORD is empty after trimming.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const authUser = await ensureSupabaseDemoUser(supabase, email, password);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existingDbUser = await prisma.user.findUnique({ where: { email } });
  if (existingDbUser && existingDbUser.id !== authUser.id) {
    throw new Error(
      `A local user already exists for email ${email} with id ${existingDbUser.id}, but Supabase auth user id is ${authUser.id}. Please reconcile manually.`
    );
  }

  const updateData = {
    passwordHash,
    role: "AGENCY_ADMIN" as const,
    name: "Demo User",
  };

  const createData = {
    id: authUser.id,
    email,
    passwordHash,
    role: "AGENCY_ADMIN" as const,
    name: "Demo User",
  };

  const user = await prisma.user.upsert({
    where: { email },
    update: updateData,
    create: createData,
  });

  console.log(
    `Seed success: demo user upserted locally with id=${user.id}, email=${user.email}`
  );
}

main().catch((error) => {
  console.error("seed-demo-user failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
