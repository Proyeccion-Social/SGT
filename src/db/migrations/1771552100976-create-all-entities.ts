import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAllEntities1771552100976 implements MigrationInterface {
    name = 'CreateAllEntities1771552100976'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "questions" ("id_question" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, CONSTRAINT "PK_42f7d8f0cb5a36bdb8873474f73" PRIMARY KEY ("id_question"))`);
        await queryRunner.query(`CREATE TABLE "answers" ("id_question" uuid NOT NULL, "id_student" uuid NOT NULL, "id_session" uuid NOT NULL, "score" smallint, CONSTRAINT "PK_c1417fe520634f4cb323644d9f8" PRIMARY KEY ("id_question", "id_student", "id_session"))`);
        await queryRunner.query(`CREATE TYPE "public"."student_participate_session_status_enum" AS ENUM('REGISTERED', 'ATTENDED', 'ABSENT', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "student_participate_session" ("id_student" uuid NOT NULL, "id_session" uuid NOT NULL, "status" "public"."student_participate_session_status_enum", "comment" text, CONSTRAINT "PK_bd04f2a8d91eafd52dd6d937527" PRIMARY KEY ("id_student", "id_session"))`);
        await queryRunner.query(`CREATE TYPE "public"."sessions_type_enum" AS ENUM('INDIVIDUAL', 'GROUP')`);
        await queryRunner.query(`CREATE TYPE "public"."sessions_modality_enum" AS ENUM('PRES', 'VIRT')`);
        await queryRunner.query(`CREATE TYPE "public"."sessions_status_enum" AS ENUM('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "sessions" ("id_session" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_tutor" uuid NOT NULL, "id_subject" uuid NOT NULL, "scheduled_date" date NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "type" "public"."sessions_type_enum", "modality" "public"."sessions_modality_enum", "status" "public"."sessions_status_enum", "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_858bc8fe367b57b2de3ad3316bd" PRIMARY KEY ("id_session"))`);
        await queryRunner.query(`CREATE TABLE "scheduled_sessions" ("id_tutor" uuid NOT NULL, "id_availability" uuid NOT NULL, "id_session" uuid, CONSTRAINT "REL_6df0305f4681b7af345413ee6d" UNIQUE ("id_session"), CONSTRAINT "PK_01760f690a68a7095a22ff8475e" PRIMARY KEY ("id_tutor", "id_availability"))`);
        await queryRunner.query(`CREATE TABLE "availability" ("id_availability" uuid NOT NULL DEFAULT uuid_generate_v4(), "day_of_week" smallint NOT NULL, "start_time" TIME NOT NULL, CONSTRAINT "PK_74c354f1c8d40ea5ca04a281895" PRIMARY KEY ("id_availability"))`);
        await queryRunner.query(`CREATE TYPE "public"."tutor_have_availability_modality_enum" AS ENUM('PRES', 'VIRT')`);
        await queryRunner.query(`CREATE TABLE "tutor_have_availability" ("id_tutor" uuid NOT NULL, "id_availability" uuid NOT NULL, "modality" "public"."tutor_have_availability_modality_enum", CONSTRAINT "PK_1081a75d607ac74f1c1daac8e70" PRIMARY KEY ("id_tutor", "id_availability"))`);
        await queryRunner.query(`CREATE TABLE "tutors" ("id_user" uuid NOT NULL, "phone" character varying(20), "is_active" boolean NOT NULL DEFAULT false, "limit_disponibility" smallint, "profile_completed" boolean NOT NULL DEFAULT false, "url_image" text, CONSTRAINT "PK_8325796beb64a4c91dfe1c3955b" PRIMARY KEY ("id_user"))`);
        await queryRunner.query(`CREATE TABLE "tutor_impart_subject" ("id_tutor" uuid NOT NULL, "id_subject" uuid NOT NULL, CONSTRAINT "PK_e99569804681cad9ec6b7d8b7bf" PRIMARY KEY ("id_tutor", "id_subject"))`);
        await queryRunner.query(`CREATE TABLE "subject" ("id_subject" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_d011c391e37d9a5e63e8b04c977" UNIQUE ("name"), CONSTRAINT "PK_6a78d4af7c4f73c256c43f00c40" PRIMARY KEY ("id_subject"))`);
        await queryRunner.query(`CREATE TABLE "student_interested_subject" ("id_student" uuid NOT NULL, "id_subject" uuid NOT NULL, CONSTRAINT "PK_7669f9531866a26d5eecf993e01" PRIMARY KEY ("id_student", "id_subject"))`);
        await queryRunner.query(`CREATE TYPE "public"."students_preferred_modality_enum" AS ENUM('PRES', 'VIRT')`);
        await queryRunner.query(`CREATE TABLE "students" ("id_user" uuid NOT NULL, "career" character varying(100), "preferred_modality" "public"."students_preferred_modality_enum", CONSTRAINT "PK_b559710a42d2bf3b49062750132" PRIMARY KEY ("id_user"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('STUDENT', 'TUTOR', 'ADMIN')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'PENDING', 'BLOCKED')`);
        await queryRunner.query(`CREATE TABLE "users" ("id_user" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "email" character varying(150) NOT NULL, "password" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL, "status" "public"."users_status_enum" NOT NULL, "email_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "email_verified_at" TIMESTAMP, "failed_login_attempts" integer NOT NULL DEFAULT '0', "locked_until" TIMESTAMP, "password_changed_at" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_fbb07fa6fbd1d74bee9782fb945" PRIMARY KEY ("id_user"))`);
        await queryRunner.query(`CREATE TABLE "auth_sessions" ("id_session" uuid NOT NULL DEFAULT uuid_generate_v4(), "refresh_token_hash" character varying(255) NOT NULL, "user_agent" text, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "revoked_at" TIMESTAMP, "last_activity_at" TIMESTAMP NOT NULL DEFAULT now(), "id_user" uuid, CONSTRAINT "PK_79c7537367be7ffbbea479fbb18" PRIMARY KEY ("id_session"))`);
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" ("id_token" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_user" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "used_at" TIMESTAMP, CONSTRAINT "PK_fae074bbad2c452ca1a640fc45c" PRIMARY KEY ("id_token"))`);
        await queryRunner.query(`CREATE TABLE "email_verification_tokens" ("id_token" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_user" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "verified_at" TIMESTAMP, CONSTRAINT "PK_a7696f895a903e3327da6184d20" PRIMARY KEY ("id_token"))`);
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'ACCOUNT_CREATED', 'EMAIL_VERIFIED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REVOKED', 'SESSION_EXPIRED')`);
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_result_enum" AS ENUM('SUCCESS', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id_log" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_user" uuid, "id_session" uuid, "action" "public"."audit_logs_action_enum" NOT NULL, "result" "public"."audit_logs_result_enum" NOT NULL, "email_attempted" character varying(255), "failure_reason" text, "ip_address" character varying(45), "user_agent" text, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0db8a907e1af1cdfe86642282a2" PRIMARY KEY ("id_log"))`);
        await queryRunner.query(`ALTER TABLE "answers" ADD CONSTRAINT "FK_c570b5fef77654bf9ff41b00624" FOREIGN KEY ("id_question") REFERENCES "questions"("id_question") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "answers" ADD CONSTRAINT "FK_a34388d454fcfb0f90b6ff4b515" FOREIGN KEY ("id_student", "id_session") REFERENCES "student_participate_session"("id_student","id_session") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_participate_session" ADD CONSTRAINT "FK_049762489deb773f79eaa38e43b" FOREIGN KEY ("id_student") REFERENCES "students"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_participate_session" ADD CONSTRAINT "FK_fe4bfc9c9d6054067ca1490a5a3" FOREIGN KEY ("id_session") REFERENCES "sessions"("id_session") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_a9ed75a85efcadd71bbc8be5ee5" FOREIGN KEY ("id_tutor") REFERENCES "tutors"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_412317c2f4613f7f852ec0eaf31" FOREIGN KEY ("id_subject") REFERENCES "subject"("id_subject") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "FK_0d4b04a7079847403da2f7587cd" FOREIGN KEY ("id_tutor") REFERENCES "tutors"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "FK_c862ed5f3d65ee0ab41aa0c6fd6" FOREIGN KEY ("id_availability") REFERENCES "availability"("id_availability") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "FK_6df0305f4681b7af345413ee6d7" FOREIGN KEY ("id_session") REFERENCES "sessions"("id_session") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tutor_have_availability" ADD CONSTRAINT "FK_6fe15be85a142eb123e22c9d043" FOREIGN KEY ("id_tutor") REFERENCES "tutors"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tutor_have_availability" ADD CONSTRAINT "FK_1b75a22ce69dd4ad3eafb4ccf2f" FOREIGN KEY ("id_availability") REFERENCES "availability"("id_availability") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tutors" ADD CONSTRAINT "FK_8325796beb64a4c91dfe1c3955b" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tutor_impart_subject" ADD CONSTRAINT "FK_a11475cea15ad0c4faa5e7ade16" FOREIGN KEY ("id_tutor") REFERENCES "tutors"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tutor_impart_subject" ADD CONSTRAINT "FK_e2a77eea1cf449be7efe7147b31" FOREIGN KEY ("id_subject") REFERENCES "subject"("id_subject") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_interested_subject" ADD CONSTRAINT "FK_fa1094cb4cc067b455c39fa4ac8" FOREIGN KEY ("id_student") REFERENCES "students"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_interested_subject" ADD CONSTRAINT "FK_36ba92aa42c5d6d14eca4ac8028" FOREIGN KEY ("id_subject") REFERENCES "subject"("id_subject") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "FK_b559710a42d2bf3b49062750132" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_b266e81e60e8c49ae2eb7c46d27" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_a440159fb2d7b579070f5206044" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "FK_8e4afd15aa5933a0aef14ddc743" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_1aabbc22a9f345c55ee39bf5daf" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_25d884c2a4c2cb629dc994e82d1" FOREIGN KEY ("id_session") REFERENCES "auth_sessions"("id_session") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_25d884c2a4c2cb629dc994e82d1"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_1aabbc22a9f345c55ee39bf5daf"`);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" DROP CONSTRAINT "FK_8e4afd15aa5933a0aef14ddc743"`);
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_a440159fb2d7b579070f5206044"`);
        await queryRunner.query(`ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_b266e81e60e8c49ae2eb7c46d27"`);
        await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "FK_b559710a42d2bf3b49062750132"`);
        await queryRunner.query(`ALTER TABLE "student_interested_subject" DROP CONSTRAINT "FK_36ba92aa42c5d6d14eca4ac8028"`);
        await queryRunner.query(`ALTER TABLE "student_interested_subject" DROP CONSTRAINT "FK_fa1094cb4cc067b455c39fa4ac8"`);
        await queryRunner.query(`ALTER TABLE "tutor_impart_subject" DROP CONSTRAINT "FK_e2a77eea1cf449be7efe7147b31"`);
        await queryRunner.query(`ALTER TABLE "tutor_impart_subject" DROP CONSTRAINT "FK_a11475cea15ad0c4faa5e7ade16"`);
        await queryRunner.query(`ALTER TABLE "tutors" DROP CONSTRAINT "FK_8325796beb64a4c91dfe1c3955b"`);
        await queryRunner.query(`ALTER TABLE "tutor_have_availability" DROP CONSTRAINT "FK_1b75a22ce69dd4ad3eafb4ccf2f"`);
        await queryRunner.query(`ALTER TABLE "tutor_have_availability" DROP CONSTRAINT "FK_6fe15be85a142eb123e22c9d043"`);
        await queryRunner.query(`ALTER TABLE "scheduled_sessions" DROP CONSTRAINT "FK_6df0305f4681b7af345413ee6d7"`);
        await queryRunner.query(`ALTER TABLE "scheduled_sessions" DROP CONSTRAINT "FK_c862ed5f3d65ee0ab41aa0c6fd6"`);
        await queryRunner.query(`ALTER TABLE "scheduled_sessions" DROP CONSTRAINT "FK_0d4b04a7079847403da2f7587cd"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_412317c2f4613f7f852ec0eaf31"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_a9ed75a85efcadd71bbc8be5ee5"`);
        await queryRunner.query(`ALTER TABLE "student_participate_session" DROP CONSTRAINT "FK_fe4bfc9c9d6054067ca1490a5a3"`);
        await queryRunner.query(`ALTER TABLE "student_participate_session" DROP CONSTRAINT "FK_049762489deb773f79eaa38e43b"`);
        await queryRunner.query(`ALTER TABLE "answers" DROP CONSTRAINT "FK_a34388d454fcfb0f90b6ff4b515"`);
        await queryRunner.query(`ALTER TABLE "answers" DROP CONSTRAINT "FK_c570b5fef77654bf9ff41b00624"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_result_enum"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
        await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
        await queryRunner.query(`DROP TABLE "auth_sessions"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "students"`);
        await queryRunner.query(`DROP TYPE "public"."students_preferred_modality_enum"`);
        await queryRunner.query(`DROP TABLE "student_interested_subject"`);
        await queryRunner.query(`DROP TABLE "subject"`);
        await queryRunner.query(`DROP TABLE "tutor_impart_subject"`);
        await queryRunner.query(`DROP TABLE "tutors"`);
        await queryRunner.query(`DROP TABLE "tutor_have_availability"`);
        await queryRunner.query(`DROP TYPE "public"."tutor_have_availability_modality_enum"`);
        await queryRunner.query(`DROP TABLE "availability"`);
        await queryRunner.query(`DROP TABLE "scheduled_sessions"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP TYPE "public"."sessions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sessions_modality_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sessions_type_enum"`);
        await queryRunner.query(`DROP TABLE "student_participate_session"`);
        await queryRunner.query(`DROP TYPE "public"."student_participate_session_status_enum"`);
        await queryRunner.query(`DROP TABLE "answers"`);
        await queryRunner.query(`DROP TABLE "questions"`);
    }

}
