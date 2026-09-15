import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "volunteer" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await register(form);
      navigate(user.role === "coordinator" ? "/coordinator" : user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-display text-2xl font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-ink/70">
        This is an academic prototype inspired by PERTAPIS's public programmes.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="register-name" className="block text-sm font-medium">Name</label>
          <input
            id="register-name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus-visible:outline-none"
          />
        </div>
        <div>
          <label htmlFor="register-email" className="block text-sm font-medium">Email</label>
          <input
            id="register-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus-visible:outline-none"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="block text-sm font-medium">Password</label>
          <input
            id="register-password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus-visible:outline-none"
          />
        </div>
        <fieldset>
          <legend className="block text-sm font-medium">I am joining as a...</legend>
          <div className="mt-2 flex gap-3">
            {["volunteer", "coordinator"].map((r) => (
              <button
                type="button"
                key={r}
                aria-pressed={form.role === r}
                onClick={() => update("role", r)}
                className={`flex-1 rounded border px-3 py-2 text-sm capitalize ${
                  form.role === r
                    ? "border-forest bg-forest/10 text-forest-dark"
                    : "border-line text-ink/70"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-brick">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-forest px-4 py-2.5 font-medium text-white hover:bg-forest-dark disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/70">
        Already have an account?{" "}
        <Link to="/login" className="text-forest underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
