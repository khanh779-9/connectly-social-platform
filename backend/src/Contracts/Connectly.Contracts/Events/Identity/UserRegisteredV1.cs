namespace Connectly.Contracts.Events.Identity;

/// <summary>Raised when a new account is created. Social Service listens to bootstrap the profile.</summary>
public sealed record UserRegisteredV1
(
    Guid UserId,
    string Email,
    string DisplayName
);
