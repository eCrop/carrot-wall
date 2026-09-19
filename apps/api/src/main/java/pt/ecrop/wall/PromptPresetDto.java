package pt.ecrop.wall;

public record PromptPresetDto(Long id, String text) {

    static PromptPresetDto from(PromptPreset preset) {
        return new PromptPresetDto(preset.id, preset.text);
    }
}
