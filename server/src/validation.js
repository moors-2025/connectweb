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

// Admin user-management (server/src/routes/admin.js): create a user directly,
// bypassing self-registration. Unlike registerSchema, role is required (an
// admin must choose deliberately) and includes "admin" itself.
const adminUserCreateSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  email: z.string().trim().email("valid email is required"),
  password: z.string().min(8, "password must be at least 8 characters").max(200),
  role: z.enum(["volunteer", "coordinator", "admin"]),
});

// Admin user-management: edit an existing user, or enable/disable their account.
// Every field is optional (a PATCH may touch just one), but at least one must
// be present — an empty body is rejected rather than silently accepted as a
// no-op, since that almost always means the caller made a mistake.
const adminUserUpdateSchema = z
  .object({
    active: z.boolean().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().optional(),
    role: z.enum(["volunteer", "coordinator", "admin"]).optional(),
    password: z.string().min(8, "password must be at least 8 characters").max(200).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "At least one field must be provided" });

// Admin user-management: reassign a user's created opportunities to another
// active coordinator or admin, ahead of disabling them.
const adminTransferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1, "newOwnerId is required"),
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
  adminUserCreateSchema,
  adminUserUpdateSchema,
  adminTransferOwnershipSchema,
};
