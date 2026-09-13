export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "pharmacist" | "cashier" | "inventory_staff" | "manager";
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

// Swap this implementation with real API calls when the backend is ready.
// Replace the function body — the interface stays unchanged.
export async function loginRequest(credentials: LoginCredentials): Promise<AuthResponse> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  if (
    credentials.email === "admin@pharmacy.com" &&
    credentials.password === "password"
  ) {
    return {
      user: { id: "1", name: "Admin User", email: credentials.email, role: "admin" },
      token: "mock-jwt-token",
    };
  }

  throw new Error("Invalid email or password. Try admin@pharmacy.com / password");
}
