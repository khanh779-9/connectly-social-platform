using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMorePrivacySettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "comment_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "followers_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "searchable_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "comment_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "followers_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "searchable_audience",
                schema: "social",
                table: "profiles");
        }
    }
}
