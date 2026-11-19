import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getRefreshToken,
  verifyRefreshToken,
  revokeTokenFamily,
  createTokenFamily,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  verifyAccessToken,
  isTokenFamilyValid as checkTokenFamily,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) {
      return NextResponse.json(
        { error: "missing_refresh_token" },
        { status: 401 },
      );
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json(
        { error: "invalid_refresh_token" },
        { status: 401 },
      );
    }

    const { sub: userId, fid: familyId } = payload as {
      sub: string;
      fid: string;
    };

    // Validate token family
    if (!familyId || !checkTokenFamily(familyId)) {
      return NextResponse.json(
        { error: "invalid_token_family" },
        { status: 401 },
      );
    }

    // Revoke old family
    revokeTokenFamily(familyId);

    // Create new token family
    const newFamilyId = `${userId}:${crypto.randomUUID()}`;
    createTokenFamily(newFamilyId);

    // Generate new tokens
    const accessToken = generateAccessToken({ sub: userId, fid: newFamilyId });
    const newRefreshToken = generateRefreshToken({
      sub: userId,
      fid: newFamilyId,
    });

    const response = NextResponse.json({
      authenticated: true,
      user: { id: userId },
    });
    setAuthCookies(response, accessToken, newRefreshToken);

    return response;
  } catch {
    return NextResponse.json({ error: "refresh_failed" }, { status: 500 });
  }
}
