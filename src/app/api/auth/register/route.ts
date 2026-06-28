import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
    });

    return NextResponse.json(
      { id: user._id.toString(), name: user.name, email: user.email },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
