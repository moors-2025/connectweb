const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  email: z.string().trim().email("valid email is required"),
  password: z.string().min(8, "password must be at least 8 characters").max(200),
  role: z.enum(["volunteer", "coordinator"]).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const opportunityCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(4000),
  category: z.string().trim().min(1).max(200),
  commitmentType: z.enum(["ad_hoc", "recurring", "mentoring"]),
  location: z.string().trim().min(1).max(300),
  startDatetime: z.string().min(1),
  endDatetime: z.string().min(1),
  capacity: z.coerce.number().int().positive(),
  requiresBriefing: z.boolean().optional(),
});

const opportunityUpdateSchema = opportunityCreateSchema.partial().extend({
  status: z.enum(["open", "closed", "cancelled"]).optional(),
});

const applySchema = z.object({
  message: z.string().trim().max(2000).optional().nullable(),
});

// BR4: approving a briefing-required opportunity needs an explicit confirmation,
// either already on the application or included in this same request.
const applicationPatchSchema = z.object({
  status: z.enum(["approved", "declined"]),
  briefingConfirmed: z.boolean().optional(),
});

const attendanceSchema = z.object({
  opportunityId: z.string().min(1),
  volunteerId: z.string().min(1),
  attended: z.boolean().optional(),
  hoursCompleted: z.coerce.number().min(0).max(24).optional(),
});

const profileUpdateSchema = z.object({
  skills: z.string().max(1000).optional().nullable(),
  interests: z.string().max(1000).optional().nullable(),
  availability: z.string().max(1000).optional().nullable(),
  preferredLocations: z.string().max(1000).optional().nullable(),
  commitmentPreference: z.enum(["ad_hoc", "recurring", "mentoring"]).optional().nullable(),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  opportunityCreateSchema,
  opportunityUpdateSchema,
  applySchema,
  applicationPatchSchema,
  attendanceSchema,
  profileUpdateSchema,
};
