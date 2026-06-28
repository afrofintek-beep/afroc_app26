# Authorization Level System Documentation

## Overview

The AFRO ID application implements a comprehensive 5-tier authorization system that restricts features based on user trust level. Users progress through levels by meeting specific criteria related to account activity, verifications, and community participation.

## Authorization Levels

### Level 1: Basic (New User)
**Criteria:**
- Just registered account
- Email verified

**Permissions:**
- Create 1 AFRO ID record (draft only)
- View own profile
- Complete onboarding
- Read documentation

**Restrictions:**
- Cannot be a witness
- Cannot view other users' records
- Limited to 1 AFRO ID record

---

### Level 2: Verified (Identity Created)
**Criteria:**
- Has at least 1 AFRO ID record
- Profile 100% complete (full_name, phone, country, city)
- AFRO ID has valid address

**Permissions:**
- Create up to 5 AFRO ID records
- View own witnesses
- Request witnesses
- Edit draft records

**Restrictions:**
- Cannot be a witness yet
- Cannot access validation features

---

### Level 3: Trusted (Community Verified)
**Criteria:**
- 2+ confirmed witnesses on at least one AFRO ID
- Account active for 7+ days
- All witness OTPs verified
- Complete profile

**Permissions:**
- **Can be a witness for others** ✅
- View other users' public AFRO IDs
- Submit records for validation
- Create up to 5 AFRO ID records

**Restrictions:**
- Cannot perform authority validations
- Cannot access full analytics

---

### Level 4: Certified (Authority Validated)
**Criteria:**
- 1+ AFRO ID with official validation
- Authority signature present
- Validation not expired
- 3+ successful witness participations

**Permissions:**
- Priority processing for new records
- Witness unlimited records
- Access validation history
- View limited analytics
- Export own records
- Create up to 10 AFRO ID records
- Request moderator role

**Restrictions:**
- Cannot validate others unless moderator/admin

---

### Level 5: Elite (Multi-Validated)
**Criteria:**
- 3+ AFRO IDs with authority validations
- Successfully witnessed 10+ users
- Account active for 90+ days
- 95%+ witness confirmation rate

**Permissions:**
- All Level 4 permissions PLUS:
- Unlimited AFRO ID records
- Advanced analytics access
- Priority support
- Can nominate others for validation
- Special badge/recognition
- Reduced validation processing time

---

## Database Schema

### Table: `user_authorization_levels`

```sql
CREATE TABLE user_authorization_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  current_level integer NOT NULL DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 5),
  level_achieved_at timestamptz DEFAULT now(),
  witness_count integer DEFAULT 0,
  witness_success_rate numeric(5,2) DEFAULT 0,
  validation_count integer DEFAULT 0,
  account_age_days integer DEFAULT 0,
  afroid_count integer DEFAULT 0,
  last_evaluated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Key Functions

### `calculate_user_authorization_level(_user_id uuid)`
Calculates the appropriate authorization level for a user based on all criteria.

### `update_user_authorization_level(_user_id uuid)`
Updates the user's authorization level in the database, recalculating statistics.

### `has_min_level(_user_id uuid, _min_level integer)`
Returns boolean indicating if user meets minimum level requirement (used in RLS policies).

## Automatic Level Updates

The system automatically recalculates levels when:
- User profile is updated
- AFRO ID record is created/updated
- Witness status changes to "confirmed"
- Authority validation is received

**Triggers:**
- `on_profile_updated` - After profile INSERT/UPDATE
- `on_afroid_record_updated` - After AFRO ID record INSERT/UPDATE
- `on_witness_updated` - After witness INSERT/UPDATE
- `on_validation_created` - After validation INSERT

## Manual Recalculation

To manually recalculate all user levels, call the edge function:

```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/recalculate-authorization-levels \
  -H "Authorization: Bearer [YOUR_JWT_TOKEN]" \
  -H "Content-Type: application/json"
```

## UI Components

### `AuthorizationLevelBadge`
Displays user's current level with color-coding and tooltip showing requirements.

```tsx
<AuthorizationLevelBadge level={3} size="md" showTooltip />
```

### `AuthorizationLevelProgress`
Shows comprehensive progress card with statistics and requirements for next level.

```tsx
<AuthorizationLevelProgress authLevel={authLevel} />
```

### `LevelGate`
Conditionally renders content based on minimum required level.

```tsx
<LevelGate requiredLevel={3} message="Level 3 required to witness">
  <Button>Become a Witness</Button>
</LevelGate>
```

## Usage in Code

### Check User Level
```tsx
import { useAuthorizationLevel, hasMinimumLevel } from "@/hooks/useAuthorizationLevel";

function MyComponent() {
  const { data: authLevel } = useAuthorizationLevel();
  const canWitness = hasMinimumLevel(authLevel?.current_level, 3);
  
  return (
    <div>Current Level: {authLevel?.current_level}</div>
  );
}
```

### Gate Features by Level
```tsx
<LevelGate 
  requiredLevel={3} 
  message="Complete 2 witness verifications to unlock this feature"
>
  <FeatureComponent />
</LevelGate>
```

### Limit Actions by Level
```tsx
const maxRecords = {
  1: 1,
  2: 5,
  3: 5,
  4: 10,
  5: Infinity
}[authLevel?.current_level || 1];

const canCreateMore = userRecords.length < maxRecords;
```

## Admin Features

### User Levels Page (`/user-levels`)
Admins can view all users and their authorization levels with:
- Level distribution statistics
- Search and filter users
- View user metrics (witnesses, validations, etc.)
- User age and activity

### Override Levels (Future Enhancement)
Admins can manually override user levels in special cases (to be implemented).

## Security Considerations

✅ **RLS Policies** - All authorization level data is protected by Row-Level Security
✅ **Server-Side Validation** - Level calculations happen server-side via security definer functions
✅ **Automatic Updates** - Triggers ensure levels stay current
✅ **Audit Trail** - `level_achieved_at` and `last_evaluated_at` track changes
✅ **No Client Manipulation** - Levels cannot be modified directly by users

## Testing

### Initialize Test User
```sql
-- Create authorization level for existing user
INSERT INTO user_authorization_levels (user_id, current_level)
VALUES ('user-uuid-here', 1);
```

### Manually Set Level (Testing Only)
```sql
UPDATE user_authorization_levels
SET current_level = 3
WHERE user_id = 'user-uuid-here';
```

### Trigger Recalculation
```sql
SELECT update_user_authorization_level('user-uuid-here');
```

## Future Enhancements

- [ ] Email notifications when users level up
- [ ] Achievement badges for milestones
- [ ] Level-based rewards program
- [ ] Gamification dashboard
- [ ] Admin override UI for special cases
- [ ] Level-specific onboarding flows
- [ ] Referral bonuses for higher levels
- [ ] Automated level degradation for inactive accounts
