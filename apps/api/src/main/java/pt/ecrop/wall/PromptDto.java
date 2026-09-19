package pt.ecrop.wall;

public record PromptDto(Long id, String text) {

    static PromptDto from(Prompt prompt) {
        return prompt == null ? null : new PromptDto(prompt.id, prompt.text);
    }
}
