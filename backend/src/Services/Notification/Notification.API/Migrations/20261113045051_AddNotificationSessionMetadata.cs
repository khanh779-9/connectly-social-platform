using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Notification.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationSessionMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "notification");

            migrationBuilder.RenameTable(
                name: "outbox_messages",
                newName: "outbox_messages",
                newSchema: "notification");

            migrationBuilder.RenameTable(
                name: "notifications",
                newName: "notifications",
                newSchema: "notification");

            migrationBuilder.RenameTable(
                name: "inbox_messages",
                newName: "inbox_messages",
                newSchema: "notification");

            migrationBuilder.RenameColumn(
                name: "Payload",
                schema: "notification",
                table: "outbox_messages",
                newName: "payload");

            migrationBuilder.RenameColumn(
                name: "Attempts",
                schema: "notification",
                table: "outbox_messages",
                newName: "attempts");

            migrationBuilder.RenameColumn(
                name: "Id",
                schema: "notification",
                table: "outbox_messages",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "ProcessedAt",
                schema: "notification",
                table: "outbox_messages",
                newName: "processed_at");

            migrationBuilder.RenameColumn(
                name: "OccurredAt",
                schema: "notification",
                table: "outbox_messages",
                newName: "occurred_at");

            migrationBuilder.RenameColumn(
                name: "LastError",
                schema: "notification",
                table: "outbox_messages",
                newName: "last_error");

            migrationBuilder.RenameColumn(
                name: "EventType",
                schema: "notification",
                table: "outbox_messages",
                newName: "event_type");

            migrationBuilder.RenameIndex(
                name: "IX_outbox_messages_ProcessedAt_OccurredAt",
                schema: "notification",
                table: "outbox_messages",
                newName: "IX_outbox_messages_processed_at_occurred_at");

            migrationBuilder.RenameColumn(
                name: "Type",
                schema: "notification",
                table: "notifications",
                newName: "type");

            migrationBuilder.RenameColumn(
                name: "Status",
                schema: "notification",
                table: "notifications",
                newName: "status");

            migrationBuilder.RenameColumn(
                name: "Preview",
                schema: "notification",
                table: "notifications",
                newName: "preview");

            migrationBuilder.RenameColumn(
                name: "Id",
                schema: "notification",
                table: "notifications",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "TargetPostId",
                schema: "notification",
                table: "notifications",
                newName: "target_post_id");

            migrationBuilder.RenameColumn(
                name: "TargetCommentId",
                schema: "notification",
                table: "notifications",
                newName: "target_comment_id");

            migrationBuilder.RenameColumn(
                name: "RecipientUserId",
                schema: "notification",
                table: "notifications",
                newName: "recipient_user_id");

            migrationBuilder.RenameColumn(
                name: "ReadAt",
                schema: "notification",
                table: "notifications",
                newName: "read_at");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                schema: "notification",
                table: "notifications",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "ActorUserId",
                schema: "notification",
                table: "notifications",
                newName: "actor_user_id");

            migrationBuilder.RenameIndex(
                name: "IX_notifications_RecipientUserId_Status",
                schema: "notification",
                table: "notifications",
                newName: "IX_notifications_recipient_user_id_status");

            migrationBuilder.RenameIndex(
                name: "IX_notifications_RecipientUserId_CreatedAt",
                schema: "notification",
                table: "notifications",
                newName: "IX_notifications_recipient_user_id_created_at");

            migrationBuilder.RenameColumn(
                name: "ProcessedAt",
                schema: "notification",
                table: "inbox_messages",
                newName: "processed_at");

            migrationBuilder.RenameColumn(
                name: "EventType",
                schema: "notification",
                table: "inbox_messages",
                newName: "event_type");

            migrationBuilder.RenameColumn(
                name: "EventId",
                schema: "notification",
                table: "inbox_messages",
                newName: "event_id");

            migrationBuilder.AddColumn<string>(
                name: "device_label",
                schema: "notification",
                table: "notifications",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ip_address",
                schema: "notification",
                table: "notifications",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "location",
                schema: "notification",
                table: "notifications",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "device_label",
                schema: "notification",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "ip_address",
                schema: "notification",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "location",
                schema: "notification",
                table: "notifications");

            migrationBuilder.RenameTable(
                name: "outbox_messages",
                schema: "notification",
                newName: "outbox_messages");

            migrationBuilder.RenameTable(
                name: "notifications",
                schema: "notification",
                newName: "notifications");

            migrationBuilder.RenameTable(
                name: "inbox_messages",
                schema: "notification",
                newName: "inbox_messages");

            migrationBuilder.RenameColumn(
                name: "payload",
                table: "outbox_messages",
                newName: "Payload");

            migrationBuilder.RenameColumn(
                name: "attempts",
                table: "outbox_messages",
                newName: "Attempts");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "outbox_messages",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "processed_at",
                table: "outbox_messages",
                newName: "ProcessedAt");

            migrationBuilder.RenameColumn(
                name: "occurred_at",
                table: "outbox_messages",
                newName: "OccurredAt");

            migrationBuilder.RenameColumn(
                name: "last_error",
                table: "outbox_messages",
                newName: "LastError");

            migrationBuilder.RenameColumn(
                name: "event_type",
                table: "outbox_messages",
                newName: "EventType");

            migrationBuilder.RenameIndex(
                name: "IX_outbox_messages_processed_at_occurred_at",
                table: "outbox_messages",
                newName: "IX_outbox_messages_ProcessedAt_OccurredAt");

            migrationBuilder.RenameColumn(
                name: "type",
                table: "notifications",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "status",
                table: "notifications",
                newName: "Status");

            migrationBuilder.RenameColumn(
                name: "preview",
                table: "notifications",
                newName: "Preview");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "notifications",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "target_post_id",
                table: "notifications",
                newName: "TargetPostId");

            migrationBuilder.RenameColumn(
                name: "target_comment_id",
                table: "notifications",
                newName: "TargetCommentId");

            migrationBuilder.RenameColumn(
                name: "recipient_user_id",
                table: "notifications",
                newName: "RecipientUserId");

            migrationBuilder.RenameColumn(
                name: "read_at",
                table: "notifications",
                newName: "ReadAt");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "notifications",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "actor_user_id",
                table: "notifications",
                newName: "ActorUserId");

            migrationBuilder.RenameIndex(
                name: "IX_notifications_recipient_user_id_status",
                table: "notifications",
                newName: "IX_notifications_RecipientUserId_Status");

            migrationBuilder.RenameIndex(
                name: "IX_notifications_recipient_user_id_created_at",
                table: "notifications",
                newName: "IX_notifications_RecipientUserId_CreatedAt");

            migrationBuilder.RenameColumn(
                name: "processed_at",
                table: "inbox_messages",
                newName: "ProcessedAt");

            migrationBuilder.RenameColumn(
                name: "event_type",
                table: "inbox_messages",
                newName: "EventType");

            migrationBuilder.RenameColumn(
                name: "event_id",
                table: "inbox_messages",
                newName: "EventId");
        }
    }
}
